# -*- coding: utf-8 -*-
#
# This file is part of couchapp released under the Apache 2 license. 
# See the NOTICE for more information.

import os

from .client import Database
from .errors import AppError
from . import util


class Config(object):
    """ main object to read configuration from ~/.couchapp.conf or 
    .couchapprc/couchapp.json in the couchapp folder.
    """
    DEFAULT_SERVER_URI = "http://127.0.0.1:5984"
    
    DEFAULTS = dict(
        env = {},
        extensions = [],
        hooks = {}
        
    )
    
    def __init__(self):
        self.rc_path = util.rcpath()
        self.global_conf = self.load(self.rc_path, self.DEFAULTS)
        self.local_conf = {}
        self.app_dir = util.findcouchapp(os.getcwd())
        if self.app_dir:
            self.local_conf = self.load_local(self.app_dir)
            
        self.conf = self.global_conf.copy()
        self.conf.update(self.local_conf)

    def load(self, path, default=None):
        """ load config """
        conf = default
        
        if isinstance(path, basestring):
            paths = [path]
        else:
            paths = path
            
        for p in paths:
            if os.path.isfile(p):
                try:
                    new_conf = util.read_json(p, use_environment=True,
                        raise_on_error=True)
                except ValueError:
                    raise AppError("Error while reading %s" % p)
                conf.update(new_conf)
        
        return conf
        
    def load_local(self, app_path):
        """ load local config """
        paths = []
        for fname in ['couchapp.json', '.couchapprc']:
            paths.append(os.path.join(app_path, fname))
        return self.load(paths, {})
        
    def update(self, path):
        self.conf = self.global_conf.copy()
        self.local_conf.update(self.load_local(path))
        self.conf.update(self.local_conf)      
   
    def get(self, key, default=None):
        try:
            return getattr(self, key)
        except AttributeError:
            pass
        return self.conf[key]

    def __getitem__(self, key):
        try:
            return getattr(self, key)
        except AttributeError:
            pass
        return self.conf[key]
        
    def __getattr__(self, key):
        try:
            getattr(super(Config, self), key)
        except AttributeError:
            if key in self.conf:
                return self.conf[key]
            raise
            
    def __contains__(self, key):
        return (key in self.conf)
        
    def __iter__(self):
        for k in list(self.conf.keys()):
            yield self[k]
        
    @property
    def extensions(self):
        """ load extensions from conf """
        extensions_list = []
        if not "extensions" in self.conf:
            return extensions_list
        for uri in self.conf.get('extensions'):
            script = util.load_py(uri, self)
            extensions_list.append(script)
        return extensions_list
        
    @property
    def hooks(self):
        hooks = {}
        if not "hooks" in self.conf:
            return hooks
        for hooktype, uris in self.conf.get("hooks").items():
            scripts = []
            for uri in uris:
                scripts.append(util.hook_uri(uri, self))
            hooks[hooktype] = scripts
        return hooks
        
    # TODO: add oauth management
    def get_dbs(self, db_string=None):
        db_string = db_string or ''
        if db_string.startswith("http://") or \
                db_string.startswith("https://") or \
                db_string.startswith("desktopcouch://"):
            dburls = db_string
        else:
            env = self.conf.get('env', {})
            if not db_string:
                # get default db if it exists
                if 'default' in env:
                    dburls = env['default']['db']
                else:
                    raise AppError("database isn't specified")
            else:
                dburls = "%s/%s" % (self.DEFAULT_SERVER_URI, db_string)
                if db_string in env:
                    dburls = env[db_string].get('db', dburls)
        
        if isinstance(dburls, basestring):
            dburls = [dburls]

        return [Database(dburl) for dburl in dburls]
        
    def get_app_name(self, dbstring=None, default=None):
        env = self.conf.get('env', {})
        if not dbstring.startswith("http://"):
            if dbstring in env:
                return env[dbstring].get('name', default)
            elif 'default' in env:
                return env['default'].get('name', default)
        elif not dbstring and 'default' in env:
                return env['default'].get('name', default)
        return default
        
