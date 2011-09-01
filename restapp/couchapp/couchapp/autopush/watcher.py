# -*- coding: utf-8 -*-
#
# This file is part of couchapp released under the Apache 2 license. 
# See the NOTICE for more information.

import logging
import signal
import time
import traceback

from . import DEFAULT_UPDATE_DELAY
from .handler import CouchappEventHandler
from .pathtools.path import absolute_path
from .watchdog.observers import Observer


log = logging.getLogger(__name__)


class CouchappWatcher(object):

    SIG_QUEUE = []
    SIGNALS = map(
            lambda x: getattr(signal, "SIG%s" % x),
            "QUIT INT TERM".split())

    SIG_NAMES = dict(
            (getattr(signal, name), name[3:].lower()) \
                    for name in dir(signal) \
                    if name[:3] == "SIG" and name[3] != "_")

    def __init__(self, doc, dbs, update_delay=DEFAULT_UPDATE_DELAY, 
            noatomic=False):
        self.doc_path = absolute_path(doc.docdir)
        self.event_handler = CouchappEventHandler(doc, dbs,
                update_delay=update_delay, noatomic=noatomic)
        self.observer = Observer()
        self.observer.schedule(self.event_handler,
                self.doc_path, recursive=True)

    def init_signals(self):
        """\
        Initialize master signal handling. Most of the signals
        are queued. Child signals only wake up the master.
        """
        map(lambda s: signal.signal(s, self.signal), self.SIGNALS)
        signal.signal(signal.SIGCHLD, self.handle_chld)

    def signal(self, sig, frame):
        if len(self.SIG_QUEUE) < 5:
            self.SIG_QUEUE.append(sig)
        else:
            log.warn("Dropping signal: %s" % sig)

    def handle_chld(self, sig, frame):
        return

    def handle_quit(self):
        raise StopIteration

    def handle_int(self):
        raise StopIteration

    def handle_term(self):
        raise StopIteration

    def run(self):
        log.info("Starting to listen changes in '%s'", self.doc_path)
        self.init_signals()
        self.observer.start()
        while True:
            try:
                sig = self.SIG_QUEUE.pop(0) if len(self.SIG_QUEUE) else None
                if sig is None:
                    self.event_handler.maybe_update() 
                elif sig in self.SIG_NAMES:
                    signame = self.SIG_NAMES.get(sig)
                    handler = getattr(self, "handle_%s" % signame, None)
                    if not handler:
                        log.error("Unhandled signal: %s" % signame)
                        continue
                    log.info("handling signal: %s" % signame)
                    handler()
                else:
                    log.info("Ignoring unknown signal: %s" % sig)
                time.sleep(1)
            except (StopIteration, KeyboardInterrupt):
                self.observer.stop()
                return 0
            except Exception, e:
                log.info("unhandled exception in main loop:\n%s" %
                        traceback.format_exc())
                return -1 
        self.observer.join()
