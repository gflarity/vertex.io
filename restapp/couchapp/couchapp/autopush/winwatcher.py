# -*- coding: utf-8 -*-
#
# This file is part of couchapp released under the Apache 2 license. 
# See the NOTICE for more information.

import logging
import time

from . import DEFAULT_UPDATE_DELAY
from .handler import CouchappEventHandler
from .pathtools.path import absolute_path
from .watchdog.observers import Observer

log = logging.getLogger(__name__)

class WinCouchappWatcher(object):
    def __init__(self, doc, dbs, update_delay=DEFAULT_UPDATE_DELAY, 
            noatomic=False):
        self.doc_path = absolute_path(doc.docdir)
        self.event_handler = CouchappEventHandler(doc, dbs,
                update_delay=update_delay, noatomic=noatomic)
        self.observer = Observer()
        self.observer.schedule(self.event_handler,
                self.doc_path, recursive=True)

    def run(self):
        log.info("Starting to listen changes in '%s'", self.doc_path)
        self.observer.start()
        try:
            while True:
                self.event_handler.maybe_update()
                time.sleep(1)
        except (SystemExit, KeyboardInterrupt):
            self.observer.stop()
        self.observer.join()

