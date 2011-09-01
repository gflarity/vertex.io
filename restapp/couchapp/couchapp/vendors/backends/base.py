# -*- coding: utf-8 -*-
#
# This file is part of couchapp released under the Apache 2 license. 
# See the NOTICE for more information.

class BackendVendor(object):
    """ vendor backend interface """
    url = "",
    license =  "",
    author = "",
    author_email = "",
    description = ""
    long_description = ""
    
    scheme = None
    
    def fetch(url, path, *args, **opts):
        raise NotImplementedError
