# -*- coding: utf-8 -*-
#
# This file is part of couchapp released under the Apache 2 license. 
# See the NOTICE for more information.

import logging
import os
import re
import time

from . import DEFAULT_UPDATE_DELAY
from .watchdog.events import FileSystemEventHandler
from ..util import json, remove_comments


log = logging.getLogger(__name__)

class CouchappEventHandler(FileSystemEventHandler):

    def __init__(self, doc, dbs, update_delay=DEFAULT_UPDATE_DELAY, 
            noatomic=False):
        super(CouchappEventHandler, self).__init__()

        self.update_delay = update_delay
        self.doc = doc
        self.dbs = dbs
        self.noatomic = noatomic
        self.last_update = None

        ignorefile = os.path.join(doc.docdir, '.couchappignore')
        if os.path.exists(ignorefile):
            with open(ignorefile, 'r') as f:
                self.ignores = json.loads(remove_comments(f.read()))

    def check_ignore(self, item):
        for ign in self.ignores:
            match = re.match(ign, item)
            if match:
                return True
        return False

    def maybe_update(self):
        if not self.last_update:
            return

        diff = time.time() - self.last_update
        if diff >= self.update_delay:
            log.info("synchronize changes")
            self.doc.push(self.dbs, noatomic=self.noatomic, 
                    noindex=True)
            self.last_update = None

    def dispatch(self, ev):
        if self.check_ignore(ev.src_path):
            return

        self.last_update = time.time()
        self.maybe_update()
