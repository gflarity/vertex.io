# -*- coding: utf-8 -*-
#
# This file is part of couchapp released under the Apache 2 license. 
# See the NOTICE for more information.

import logging
import os
import sys

from . import DEFAULT_UPDATE_DELAY
from ..errors import AppError
from ..localdoc import document

if sys.platform == "win32" or os.name == "nt":
    from .winwatcher import WinCouchappWatcher as CouchappWatcher    
else:
    from .watcher import CouchappWatcher

log = logging.getLogger(__name__)

def autopush(conf, path, *args, **opts):
    doc_path = None
    dest = None
    if len(args) < 2:
        doc_path = path
        if args:
            dest = args[0]
    else:
        doc_path = os.path.normpath(os.path.join(os.getcwd(), 
            args[0]))
        dest = args[1]

    if doc_path is None:
        raise AppError("You aren't in a couchapp.")

    conf.update(doc_path)
    doc = document(doc_path, create=False, 
            docid=opts.get('docid'))
    dbs = conf.get_dbs(dest)

    update_delay = int(opts.get('update_delay', DEFAULT_UPDATE_DELAY))
    noatomic = opts.get('no_atomic', False)

    watcher = CouchappWatcher(doc, dbs, update_delay=update_delay,
            noatomic=noatomic)
    watcher.run()
