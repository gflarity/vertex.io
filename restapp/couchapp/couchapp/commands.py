# -*- coding: utf-8 -*-
#
# This file is part of couchapp released under the Apache 2 license. 
# See the NOTICE for more information.

import logging
import os

try:
    import desktopcouch
except ImportError:
    desktopcouch = None


from couchapp import clone_app
from couchapp.autopush.command import autopush, DEFAULT_UPDATE_DELAY
from couchapp.errors import ResourceNotFound, AppError, BulkSaveError
from couchapp import generator
from couchapp.localdoc import document
from couchapp import util
from couchapp.vendors import vendor_install, vendor_update

logger = logging.getLogger(__name__)


def hook(conf, path, hook_type, *args, **kwargs):
    if hook_type in conf.hooks:
        for h in conf.hooks.get(hook_type):
            if hasattr(h, 'hook'):
                h.hook(path, hook_type, *args, **kwargs)

def init(conf, path, *args, **opts):
    if not args:
        dest = os.getcwd()
    else:
        dest = os.path.normpath(os.path.join(os.getcwd(), args[0]))
        
    if dest is None:
        raise AppError("Unknown dest")
        
    document(dest, True)

def push(conf, path, *args, **opts):
    export = opts.get('export', False)
    noatomic = opts.get('no_atomic', False)
    browse = opts.get('browse', False)
    force = opts.get('force', False)
    dest = None
    doc_path = None
    if len(args) < 2:
        if export:
            if path is None and args:
                doc_path = args[0]
            else:
                doc_path = path
        else:
            doc_path = path
            if args:
                dest = args[0]
    else:
        doc_path = os.path.normpath(os.path.join(os.getcwd(), args[0]))
        dest = args[1]
    if doc_path is None:
        raise AppError("You aren't in a couchapp.")
    
    conf.update(doc_path)

    doc = document(doc_path, create=False, 
                        docid=opts.get('docid'))
    if export:
        if opts.get('output'):
            util.write_json(opts.get('output'), str(doc))
        else:
            print str(doc)
        return 0
    dbs = conf.get_dbs(dest)
    
    hook(conf, doc_path, "pre-push", dbs=dbs)    
    doc.push(dbs, noatomic, browse, force)
    hook(conf, doc_path, "post-push", dbs=dbs)
    
    docspath = os.path.join(doc_path, '_docs')
    if os.path.exists(docspath):
        pushdocs(conf, docspath, dest, *args, **opts)
    return 0

def pushapps(conf, source, dest, *args, **opts):
    export = opts.get('export', False)
    noatomic = opts.get('no_atomic', False)
    browse = opts.get('browse', False)
    dbs = conf.get_dbs(dest)
    apps = []
    source = os.path.normpath(os.path.join(os.getcwd(), source))
    for d in os.listdir(source):
        appdir = os.path.join(source, d)
        if os.path.isdir(appdir) and os.path.isfile(os.path.join(appdir, 
                                        '.couchapprc')):
            doc = document(appdir)
            hook(conf, appdir, "pre-push", dbs=dbs, pushapps=True)
            if export or not noatomic:
                apps.append(doc)
            else:
                doc.push(dbs, True, browse)
            hook(conf, appdir, "post-push", dbs=dbs, pushapps=True)
    if apps:
        if export:
            docs = []
            docs.append([doc.doc() for doc in apps])
            jsonobj = {'docs': docs}
            if opts.get('output') is not None:
                util.write_json(opts.get('output'), util.json.dumps(jsonobj))
            else:
                print util.json.dumps(jsonobj)
            return 0
        else:
            for db in dbs:
                docs = []
                docs = [doc.doc(db) for doc in apps]
                try:
                    db.save_docs(docs)
                except BulkSaveError, e:
                    docs1 = []
                    for doc in e.errors:
                        try:
                            doc['_rev'] = db.last_rev(doc['_id'])
                            docs1.append(doc)
                        except ResourceNotFound:
                            pass 
                    if docs1:
                        db.save_docs(docs1)
    return 0
  
def pushdocs(conf, source, dest, *args, **opts):
    export = opts.get('export', False)
    noatomic = opts.get('no_atomic', False)
    browse = opts.get('browse', False)
    dbs = conf.get_dbs(dest)
    docs = []
    for d in os.listdir(source):
        docdir = os.path.join(source, d)
        if docdir.startswith('.'):
            continue
        elif os.path.isfile(docdir):
            if d.endswith(".json"):
                doc = util.read_json(docdir)
                docid, ext = os.path.splitext(d)
                doc.setdefault('_id', docid)
                doc.setdefault('couchapp', {})
                if export or not noatomic:
                    docs.append(doc)
                else:
                    for db in dbs:
                        db.save_doc(doc, force_update=True)
        else:
            doc = document(docdir, is_ddoc=False)
            if export or not noatomic:
                docs.append(doc)
            else:
                doc.push(dbs, True, browse)
    if docs:
        if export:
            docs1 = []
            for doc in docs:
                if hasattr(doc, 'doc'):
                    docs1.append(doc.doc())
                else:
                    docs1.append(doc)
            jsonobj = {'docs': docs}
            if opts.get('output') is not None:
                util.write_json(opts.get('output'), util.json.dumps(jsonobj))
            else:
                print util.json.dumps(jsonobj)
        else:
            for db in dbs:
                docs1 = []
                for doc in docs:
                    if hasattr(doc, 'doc'):
                        docs1.append(doc.doc(db))
                    else:
                        newdoc = doc.copy()
                        try:
                            rev = db.last_rev(doc['_id'])
                            newdoc.update({'_rev': rev})
                        except ResourceNotFound:
                            pass
                        docs1.append(newdoc)
                try:
                    db.save_docs(docs1)
                except BulkSaveError, e:
                    # resolve conflicts
                    docs1 = []
                    for doc in e.errors:
                        try:
                            doc['_rev'] = db.last_rev(doc['_id'])
                            docs1.append(doc)
                        except ResourceNotFound:
                            pass 
                if docs1:
                    db.save_docs(docs1)
    return 0
    
def clone(conf, source, *args, **opts):
    if len(args) > 0:
        dest = args[0]
    else:
        dest = None 
    hook(conf, dest, "pre-clone", source=source)
    clone_app.clone(source, dest, rev=opts.get('rev'))
    hook(conf, dest, "post-clone", source=source)
    return 0

def startapp(conf, *args, **opts):
    if len(args) < 1:
        raise AppError("Can't start an app, name or path is missing")

    if len(args) == 1:
        name = args[0]
        dest = os.path.normpath(os.path.join(os.getcwd(), ".", name))
    elif len(args) == 2:
        
        name = args[1]
        dest = os.path.normpath(os.path.join(args[0], args[1]))

    if os.path.isfile(os.path.join(dest, ".couchapprc")):
        raise AppError("can't create an app at '%s'. One already exists"
                "here" % dest)

    generator.generate(dest, "startapp", name, **opts)
    return 0

def generate(conf, path, *args, **opts):
    dest = path
    if len(args) < 1:
        raise AppError("Can't generate function, name or path is missing")
        
    if len(args) == 1:
        kind="app"
        name = args[0]
    elif len(args) == 2:
        kind = args[0]
        name = args[1]
    elif len(args) >= 3:
        kind = args[0]
        dest = args[1]
        name = args[2]
        
    if dest is None:
        if kind == "app":
            dest = os.path.normpath(os.path.join(os.getcwd(), ".", name))
            opts['create'] = True
        else:
            raise AppError("You aren't in a couchapp.")
    
    hook(conf, dest, "pre-generate")    
    generator.generate(dest, kind, name, **opts)
    hook(conf, dest, "post-generate")
    return 0
    
def vendor(conf, path, *args, **opts):
    if len(args) < 1:
        raise AppError("missing command")
    dest = path
    args = list(args)
    cmd = args.pop(0)
    if cmd == "install":
        if len(args) < 1:
            raise AppError("missing source")
        if len(args) == 1:
            source = args.pop(0)
            
        elif len(args) > 1:
            dest = args.pop(0)
            source = args.pop(0)
        
        if dest is None:
            raise AppError("You aren't in a couchapp.")
            
        dest = os.path.normpath(os.path.join(os.getcwd(), dest))
        hook(conf, dest, "pre-vendor", source=source, action="install")
        vendor_install(conf, dest, source, *args, **opts)
        hook(conf, dest, "post-vendor", source=source, action="install")
    else:
        vendorname = None
        if len(args) == 1:
            vendorname=args.pop(0)
        elif len(args) >= 2:
            dest = args.pop(0)
            vendorname=args.pop(0)
        if dest is None:
            raise AppError("You aren't in a couchapp.")
            
        dest = os.path.normpath(os.path.join(os.getcwd(), dest))
        hook(conf, dest, "pre-vendor", name=vendorname, action="update")
        vendor_update(conf, dest, vendorname, *args, **opts)
        hook(conf, dest, "pre-vendor", name=vendorname, action="update")
    return 0


def browse(conf, path, *args, **opts):
    dest = None
    doc_path = None
    if len(args) < 2:
        doc_path = path
        if args:
            dest = args[0]
    else:
        doc_path = os.path.normpath(os.path.join(os.getcwd(), args[0]))
        dest = args[1]
    if doc_path is None:
        raise AppError("You aren't in a couchapp.")
    
    conf.update(doc_path)

    doc = document(doc_path, create=False, 
                        docid=opts.get('docid'))

    dbs = conf.get_dbs(dest)
    doc.browse(dbs)

def version(conf, *args, **opts):
    from couchapp import __version__
    
    print "Couchapp (version %s)" % __version__
    print "Copyright 2008-2010 Benoît Chesneau <benoitc@e-engura.org>"
    print "Licensed under the Apache License, Version 2.0." 
    print ""
    if opts.get('help', False):
        usage(conf, *args, **opts)
    
    return 0
    
def usage(conf, *args, **opts):
    if opts.get('version', False):
        version(conf, *args, **opts)
    print "Usage: couchapp [OPTIONS] [CMD] [CMDOPTIONS] [ARGS,...]"

    print ""
    print "Options:"
    mainopts = []
    max_opt_len = len(max(globalopts, key=len))
    for opt in globalopts:
        print "\t%-*s" % (max_opt_len, get_switch_str(opt))
        mainopts.append(opt[0])

    print ""
    print "Commands:"
    commands = sorted(table.keys())
    max_len = len(max(commands, key=len))
    for cmd in commands:
        opts = table[cmd]
        # Command name is max_len characters. Used by the %-*s formatting code
        print "\t%-*s %s" % (max_len, cmd, opts[2])
        # Print each command's option list
        cmd_options = opts[1]
        if cmd_options:
            max_opt = max(cmd_options, key=lambda o: len(get_switch_str(o)))
            max_opt_len = len(get_switch_str(max_opt))
            for opt in cmd_options:
                print "\t\t%-*s %s" % (max_opt_len, get_switch_str(opt), opt[3])
            print ""
        print ""
    return 0

def get_switch_str(opt):
    """
    Output just the '-r, --rev [VAL]' part of the option string.
    """
    if opt[2] is None or opt[2] is True or opt[2] is False:
        default = ""
    else:
        default = "[VAL]"
    if opt[0]:
        # has a short and long option
        return "-%s, --%s %s" % (opt[0], opt[1], default)
    else:
        # only has a long option
        return "--%s %s" % (opt[1], default)

globalopts = [
    ('d', 'debug', None, "debug mode"),
    ('h', 'help', None, "display help and exit"),
    ('', 'version', None, "display version and exit"),
    ('v', 'verbose', None, "enable additionnal output"),
    ('q', 'quiet', None, "don't print any message")
]

pushopts = [
    ('', 'no-atomic', False, "send attachments one by one"),
    ('', 'export', False, "don't do push, just export doc to stdout"),
    ('', 'output', '', "if export is selected, output to the file"),
    ('b', 'browse', False, "open the couchapp in the browser"),
    ('', 'force', False, "force attachments sending")
]
    
table = {
    "init": 
        (init, 
        [], 
        "[COUCHAPPDIR]"),
    "push":
        (push,
        pushopts + [('', 'docid', '', "set docid")],
        "[OPTION]... [COUCHAPPDIR] DEST"),
    "clone":
        (clone,
        [('r', 'rev', '', "clone specific revision")],
        "[OPTION]...[-r REV] SOURCE [COUCHAPPDIR]"),
    "pushapps":
        (pushapps,
        pushopts,
        "[OPTION]... SOURCE DEST"),
    "pushdocs":
        (pushdocs,
        pushopts,
        "[OPTION]... SOURCE DEST"),
    "startapp":
        (startapp,
        [],
        "[COUCHAPPDIR] NAME"),
    "generate":
        (generate,
        [('', 'template', '', "template name")],
        "[OPTION]... [app|view,list,show,filter,function,vendor] [COUCHAPPDIR] NAME"),
    "vendor":
        (vendor,
        [("f", 'force', False, "force install or update")],
        "[OPTION]...[-f] install|update [COUCHAPPDIR] SOURCE"),
    "browse":
        (browse,
        [],
        "[COUCHAPPDIR] DEST"),
    "autopush":
        (autopush,
        [('', 'no-atomic', False, "send attachments one by one"),
        ('', 'update-delay', DEFAULT_UPDATE_DELAY, "time between each update")],
        "[OPTION]... [COUCHAPPDIR] DEST"),
    "help":
        (usage, [], ""),
    "version":
        (version, [], "")
}

withcmd = ['generate', 'vendor']
incouchapp = ['init', 'push', 'generate', 'vendor', 'autopush']
