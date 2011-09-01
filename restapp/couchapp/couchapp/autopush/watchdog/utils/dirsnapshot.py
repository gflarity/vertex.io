# -*- coding: utf-8 -*-
# dirsnapshot.py: Directory snapshots and comparison.
#
# Copyright (C) 2010 Yesudeep Mangalapilly <yesudeep@gmail.com>
#
# Permission is hereby granted, free of charge, to any person obtaining a copy
# of this software and associated documentation files (the "Software"), to deal
# in the Software without restriction, including without limitation the rights
# to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
# copies of the Software, and to permit persons to whom the Software is
# furnished to do so, subject to the following conditions:
#
# The above copyright notice and this permission notice shall be included in
# all copies or substantial portions of the Software.
#
# THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
# IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
# FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
# AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
# LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
# OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
# THE SOFTWARE.

"""
:module: watchdog.utils.dirsnapshot
:synopsis: Directory snapshots and comparison.
:author: Yesudeep Mangalapilly <yesudeep@gmail.com>

.. ADMONITION:: Where are the moved events? They "disappeared"

        This implementation does not take partition boundaries
        into consideration. It will only work when the directory
        tree is entirely on the same file system. More specifically,
        any part of the code that depends on inode numbers can
        break if partition boundaries are crossed. In these cases,
        the snapshot diff will represent file/directory movement as
        created and deleted events.

        Windows does not have any concept of ``inodes``, which prevents
        this snapshotter from determining file or directory renames/movement
        on it. The snapshotter does not try to handle this on Windows.
        File or directory movement will show up as creation and deletion
        events.

        Please do not use this on a virtual file system mapped to
        a network share.

Classes
-------
.. autoclass:: DirectorySnapshot
   :members:
   :show-inheritance:

.. autoclass:: DirectorySnapshotDiff
   :members:
   :show-inheritance:

"""

import os
import sys
import stat

from ...pathtools.path import walk as path_walk, absolute_path

if not sys.version < (2, 6, 0):
    from .bricks import OrderedSet as set

class DirectorySnapshotDiff(object):
    """
    Compares two directory snapshots and creates an object that represents
    the difference between the two snapshots.

    :param ref_dirsnap:
        The reference directory snapshot.
    :type ref_dirsnap:
        :class:`DirectorySnapshot`
    :param dirsnap:
        The directory snapshot which will be compared
        with the reference snapshot.
    :type dirsnap:
        :class:`DirectorySnapshot`
    """
    def __init__(self, ref_dirsnap, dirsnap):
        """
        """
        self._files_deleted = list()
        self._files_modified = list()
        self._files_created = list()
        self._files_moved = list()

        self._dirs_modified = list()
        self._dirs_moved = list()
        self._dirs_deleted = list()
        self._dirs_created = list()

        # Detect all the modifications.
        for path, stat_info in dirsnap.stat_snapshot.items():
            if path in ref_dirsnap.stat_snapshot:
                ref_stat_info = ref_dirsnap.stat_info(path)
                if stat_info.st_ino == ref_stat_info.st_ino and stat_info.st_mtime != ref_stat_info.st_mtime:
                    if stat.S_ISDIR(stat_info.st_mode):
                        self._dirs_modified.append(path)
                    else:
                        self._files_modified.append(path)

        paths_deleted = ref_dirsnap.paths - dirsnap.paths
        paths_created = dirsnap.paths - ref_dirsnap.paths

        # Detect all the moves/renames.
        # Doesn't work on Windows, so exlude on Windows.
        if not sys.platform.startswith('win'):
            for created_path in paths_created.copy():
                created_stat_info = dirsnap.stat_info(created_path)
                for deleted_path in paths_deleted.copy():
                    deleted_stat_info = ref_dirsnap.stat_info(deleted_path)
                    if created_stat_info.st_ino == deleted_stat_info.st_ino:
                        paths_deleted.remove(deleted_path)
                        paths_created.remove(created_path)
                        if stat.S_ISDIR(created_stat_info.st_mode):
                            self._dirs_moved.append((deleted_path, created_path))
                        else:
                            self._files_moved.append((deleted_path, created_path))

        # Now that we have renames out of the way, enlist the deleted and
        # created files/directories.
        for path in paths_deleted:
            stat_info = ref_dirsnap.stat_info(path)
            if stat.S_ISDIR(stat_info.st_mode):
                self._dirs_deleted.append(path)
            else:
                self._files_deleted.append(path)

        for path in paths_created:
            stat_info = dirsnap.stat_info(path)
            if stat.S_ISDIR(stat_info.st_mode):
                self._dirs_created.append(path)
            else:
                self._files_created.append(path)


    @property
    def files_created(self):
        """List of files that were created."""
        return self._files_created

    @property
    def files_deleted(self):
        """List of files that were deleted."""
        return self._files_deleted

    @property
    def files_modified(self):
        """List of files that were modified."""
        return self._files_modified

    @property
    def files_moved(self):
        """
        List of files that were moved.

        Each event is a two-tuple the first item of which is the path
        that has been renamed to the second item in the tuple.
        """
        return self._files_moved

    @property
    def dirs_modified(self):
        """
        List of directories that were modified.
        """
        return self._dirs_modified

    @property
    def dirs_moved(self):
        """
        List of directories that were moved.

        Each event is a two-tuple the first item of which is the path
        that has been renamed to the second item in the tuple.
        """
        return self._dirs_moved

    @property
    def dirs_deleted(self):
        """
        List of directories that were deleted.
        """
        return self._dirs_deleted

    @property
    def dirs_created(self):
        """
        List of directories that were created.
        """
        return self._dirs_created


class DirectorySnapshot(object):
    """
    A snapshot of stat information of files in a directory.

    :param path:
        The directory path for which a snapshot should be taken.
    :type path:
        ``str``
    :param recursive:
        ``True`` if the entired directory tree should be included in the
        snapshot; ``False`` otherwise.
    :type recursive:
        ``bool``
    :param walker_callback:
        A function with the signature ``walker_callback(path, stat_info)``
        which will be called for every entry in the directory tree.
    """
    def __init__(self,
                 path,
                 recursive=True,
                 walker_callback=(lambda p, s: None),
                 _copying=False):
        self._path = absolute_path(path)
        self._stat_snapshot = {}
        self._inode_to_path = {}
        self.is_recursive = recursive

        if not _copying:
            stat_info = os.stat(self._path)
            self._stat_snapshot[self._path] = stat_info
            self._inode_to_path[stat_info.st_ino] = self._path
            walker_callback(self._path, stat_info)

            for root, directories, files in path_walk(self._path, recursive):
                for directory_name in directories:
                    try:
                        directory_path = os.path.join(root, directory_name)
                        stat_info = os.stat(directory_path)
                        self._stat_snapshot[directory_path] = stat_info
                        self._inode_to_path[stat_info.st_ino] = directory_path
                        walker_callback(directory_path, stat_info)
                    except OSError:
                        continue

                for file_name in files:
                    try:
                        file_path = os.path.join(root, file_name)
                        stat_info = os.stat(file_path)
                        self._stat_snapshot[file_path] = stat_info
                        self._inode_to_path[stat_info.st_ino] = file_path
                        walker_callback(file_path, stat_info)
                    except OSError:
                        continue


    def __sub__(self, previous_dirsnap):
        """Allow subtracting a DirectorySnapshot object instance from
        another.

        :returns:
            A :class:`DirectorySnapshotDiff` object.
        """
        return DirectorySnapshotDiff(previous_dirsnap, self)

    #def __add__(self, new_dirsnap):
    #    self._stat_snapshot.update(new_dirsnap._stat_snapshot)

    def copy(self, from_pathname=None):
        snapshot = DirectorySnapshot(path=from_pathname,
                                     recursive=self.is_recursive,
                                     _copying=True)
        for pathname, stat_info in self._stat_snapshot.items():
            if pathname.starts_with(from_pathname):
                snapshot._stat_snapshot[pathname] = stat_info
                snapshot._inode_to_path[stat_info.st_ino] = pathname
        return snapshot


    @property
    def stat_snapshot(self):
        """
        Returns a dictionary of stat information with file paths being keys.
        """
        return self._stat_snapshot


    def stat_info(self, path):
        """
        Returns a stat information object for the specified path from
        the snapshot.

        :param path:
            The path for which stat information should be obtained
            from a snapshot.
        """
        return self._stat_snapshot[path]


    def path_for_inode(self, inode):
        """
        Determines the path that an inode represents in a snapshot.

        :param inode:
            inode number.
        """
        return self._inode_to_path[inode]


    def stat_info_for_inode(self, inode):
        """
        Determines stat information for a given inode.

        :param inode:
            inode number.
        """
        return self.stat_info(self.path_for_inode(inode))


    @property
    def paths(self):
        """
        List of file/directory paths in the snapshot.
        """
        return set(self._stat_snapshot)


    def __str__(self):
        return self.__repr__()

    def __repr__(self):
        return str(self._stat_snapshot)

