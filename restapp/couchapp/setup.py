# -*- coding: utf-8 -*-
#
# This file is part of couchapp released under the Apache 2 license. 
# See the NOTICE for more information.

from distutils.core import setup, Extension
from distutils.sysconfig import get_python_lib
from distutils.cmd import Command
from distutils.command import build_ext
from distutils.command.build import build
from distutils.command.install_data import install_data
import glob
from imp import load_source
import os
import sys

if not hasattr(sys, 'version_info') or sys.version_info < (2, 6, 0, 'final'):
    raise SystemExit("Couchapp requires Python 2.6 or later.")


executables = []
setup_requires = []
extra = {}

couchapp = load_source("couchapp", os.path.join("couchapp",
        "__init__.py"))

SELECT_BACKPORT_MACROS = []

if "linux" in sys.platform:
    SELECT_BACKPORT_MACROS.append(("HAVE_EPOLL", 1))
    SELECT_BACKPORT_MACROS.append(("HAVE_SYS_EPOLL_H", 1))
elif "darwin" in sys.platform or "bsd" in sys.platform:
    SELECT_BACKPORT_MACROS.append(("HAVE_KQUEUE", 1))
    SELECT_BACKPORT_MACROS.append(("HAVE_SYS_EVENT_H", 1))
else:
    pass

SELECT_BACKPORT_SOURCES = [
        os.path.join('couchapp','autopush','selectmodule.c')]

if len(SELECT_BACKPORT_MACROS) > 0:
    extra['ext_modules'] = [
        Extension("couchapp.autopush._select", 
            sources=SELECT_BACKPORT_SOURCES,
            define_macros = SELECT_BACKPORT_MACROS,
            )]

"""if "darwin" in sys.platform:
    WATCHDOG_SRC_DIR = os.path.join('couchapp', 'autopush', 'watchdog')


    watchdog_version = load_source('version',
                          os.path.join(WATCHDOG_SRC_DIR, 'version.py'))


    _watchdog_fsevents_sources = [
        os.path.join(WATCHDOG_SRC_DIR, '_watchdog_fsevents.c'),
        os.path.join(WATCHDOG_SRC_DIR, '_watchdog_util.c'),
    ]
    
    extra['ext_modules'].append(
            Extension(name='_watchdog_fsevents',
                sources=_watchdog_fsevents_sources,
                libraries=['m'],
                define_macros=[
                    ('WATCHDOG_VERSION_STRING',
                        '"' + watchdog_version.VERSION_STRING + '"'),
                    ('WATCHDOG_VERSION_MAJOR', watchdog_version.VERSION_MAJOR),
                    ('WATCHDOG_VERSION_MINOR', watchdog_version.VERSION_MINOR),
                    ('WATCHDOG_VERSION_BUILD', watchdog_version.VERSION_BUILD),
                    ],
                extra_link_args=[
                    '-framework', 'CoreFoundation',
                    '-framework', 'CoreServices',
                    ],
                extra_compile_args=[
                    '-std=c99',
                    '-pedantic',
                    '-Wall',
                    '-Wextra',
                    '-fPIC',
                    ]
                ))"""


def get_data_files():
    data_files = []
    data_files.append(('couchapp', 
                       ["LICENSE", "MANIFEST.in", "NOTICE", "README.rst",
                        "THANKS",]))
    return data_files


def ordinarypath(p):
    return p and p[0] != '.' and p[-1] != '~'

def get_packages_data():
    packagedata = {'couchapp': []}

    for root in ('templates',):
        for curdir, dirs, files in os.walk(os.path.join("couchapp", root)):
            curdir = curdir.split(os.sep, 1)[1]
            dirs[:] = filter(ordinarypath, dirs)
            for f in filter(ordinarypath, files):
                f = os.path.normpath(os.path.join(curdir, f))
                packagedata['couchapp'].append(f)
    return packagedata 


MODULES = [
        'couchapp',
        'couchapp.autopush',
        'couchapp.autopush.brownie',
        'couchapp.autopush.brownie.datastructures',
        'couchapp.autopush.pathtools',
        'couchapp.autopush.watchdog',
        'couchapp.autopush.watchdog.observers',
        'couchapp.autopush.watchdog.tricks',
        'couchapp.autopush.watchdog.utils',
        'couchapp.hooks',
        'couchapp.hooks.compress',
        'couchapp.restkit',
        'couchapp.restkit.manager',
        'couchapp.restkit.contrib',
        'couchapp.simplejson',
        'couchapp.vendors',
        'couchapp.vendors.backends',
    ]

CLASSIFIERS = [
        'License :: OSI Approved :: Apache Software License',
        'Intended Audience :: Developers',
        'Intended Audience :: System Administrators',
        'Development Status :: 4 - Beta',
        'Programming Language :: Python',
        'Operating System :: OS Independent',
        'Topic :: Database',
        'Topic :: Utilities',
    ]

def get_scripts():
    scripts = [os.path.join("resources", "scripts", "couchapp")]
    if os.name == "nt":
        scripts.append(os.path.join("resources", "scripts",
            "couchapp.bat"))
    return scripts

DATA_FILES = get_data_files()


def get_py2exe_datafiles():
    datapath = os.path.join('couchapp', 'templates')
    head, tail = os.path.split(datapath)
    d = dict(get_data_files())
    for root, dirs, files in os.walk(datapath):
        files = [os.path.join(root, filename) for filename in files]
        root = root.replace(tail, datapath)
        root = root[root.index(datapath):]
        d[root] = files
    return d.items()



if os.name == "nt" or sys.platform == "win32":
    # py2exe needs to be installed to work
    try:
        import py2exe

        # Help py2exe to find win32com.shell
        try:
            import modulefinder
            import win32com
            for p in win32com.__path__[1:]: # Take the path to win32comext
                modulefinder.AddPackagePath("win32com", p)
            pn = "win32com.shell"
            __import__(pn)
            m = sys.modules[pn]
            for p in m.__path__[1:]:
                modulefinder.AddPackagePath(pn, p)
        except ImportError:
            raise SystemExit('You need pywin32 installed ' +
                    'http://sourceforge.net/projects/pywin32')

        # If run without args, build executables, in quiet mode.
        if len(sys.argv) == 1:
            sys.argv.append("py2exe")
            sys.argv.append("-q")

        extra['console'] = [{
             'script': os.path.join("resources", "scripts", "couchapp"),
             'copyright':'Copyright (C) 2008-2011 Benoît Chesneau and others',
             'product_version': couchapp.__version__ 
        }]


    except ImportError:
        raise SystemExit('You need py2exe installed to run Couchapp.')

    DATA_FILES = get_py2exe_datafiles()

class install_package_data(install_data):
    def finalize_options(self):
        self.set_undefined_options('install',
                                   ('install_lib', 'install_dir'))
        install_data.finalize_options(self)


class my_build_ext(build_ext.build_ext):
    def initialize_options(self):
        build_ext.build_ext.initialize_options(self)


    def build_extension(self, ext):
        result = build_ext.build_ext.build_extension(self, ext)
        # hack: create a symlink from build/../select_backport.so to
        # couchapp/autopush/select_backport.so
        try:
            fullname = self.get_ext_fullname(ext.name)
            modpath = fullname.split('.')
            filename = self.get_ext_filename(ext.name)
            filename = os.path.split(filename)[-1]
            if not self.inplace:
                filename = os.path.join(*modpath[:-1] + [filename])
                path_to_build_core_so = os.path.abspath(
                        os.path.join(self.build_lib, filename))
                path_to_core_so = os.path.abspath(
                        os.path.join('couchapp', 'autopush',
                            os.path.basename(path_to_build_core_so)))
                if path_to_build_core_so != path_to_core_so:
                    try:
                        os.unlink(path_to_core_so)
                    except OSError:
                        pass
                    if hasattr(os, 'symlink'):
                        print 'Linking %s to %s' % (path_to_build_core_so, path_to_core_so)
                        os.symlink(path_to_build_core_so, path_to_core_so)
                    else:
                        print 'Copying %s to %s' % (path_to_build_core_so, path_to_core_so)
                        import shutil
                        shutil.copyfile(path_to_build_core_so, path_to_core_so)
        except Exception:
            traceback.print_exc()
        return result


cmdclass = {'install_data': install_package_data }

def main():
    # read long description
    with open(os.path.join(os.path.dirname(__file__), 'README.rst')) as f:
        long_description = f.read()

    PACKAGES = {}
    for name in MODULES:
        PACKAGES[name] = name.replace(".", "/")

    options = dict(
            name = 'Couchapp',
            version = couchapp.__version__,
            url = 'http://github.com/couchapp/couchapp/tree/master',
            license =  'Apache License 2',
            author = 'Benoit Chesneau',
            author_email = 'benoitc@e-engura.org',
            description = 'Standalone CouchDB Application Development Made Simple.',
            long_description = long_description,
            keywords = 'couchdb couchapp',
            platforms = ['any'],
            classifiers = CLASSIFIERS,
            packages = PACKAGES.keys(),
            package_dir = PACKAGES,
            data_files = DATA_FILES,
            package_data = get_packages_data(),
            cmdclass = {
                'build_ext': my_build_ext,
                'install_data': install_package_data},
            scripts=get_scripts(),
            options = dict(py2exe={
                                'dll_excludes': [
                                    "kernelbase.dll",
                                    "powrprof.dll" 
                                ]
                           },

                           bdist_mpkg=dict(zipdist=True,
                                           license='LICENSE',
                                           readme='resources/macosx/Readme.html',
                                           welcome='resources/macosx/Welcome.html')
            )
    )
    options.update(extra)
    setup(**options)

if __name__ == "__main__":
    main()



