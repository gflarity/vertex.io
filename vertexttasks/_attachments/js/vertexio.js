
function VertexIO(params) {
    var that = this;
    this.connected = true;//TODO
    this.username = "";
    this.params = params;
    //this.socket = new io.Socket(options);
    this.db = $.couch.db(params.dbName);

    this.localDocs = {};
    this.persistedDocs = {};

    this.requestQueue = [];
    this.requestOutstanding = false;

   /* this.socket.on("connect", function() {
        that.connected = true;

        that.sync();
    });

    this.socket.on("disconnect", function() {
        that.connected = false;
    });*/
}

VertexIO.prototype.sync = function() {
    if(!this.connected) {
        return false;
    }

    if(!this.requestQueue.length) {
        return false;
    }

    if(this.requestOutstanding) {
        return false;
    }

    var request = this.requestQueue[0];
    var that = this;
    switch(request.type) {
    case "save":
        this.requestOutstanding = true;
        var doc = request.data;
        this.db.saveDoc(doc,
            { success:
                function() {
                    that.requestOutstanding = false;
                    that.persistedDocs[doc._id] = true;
                    that.requestQueue.shift();
                    that.sync();
                },
              error:
                function() {
                    that.requestOutstanding = false;
                    setTimeout(function() { that.sync(); }, 1000);
                }
            }
        );
        break;
    case "remove":
        this.requestOutstanding = true;
        var doc = request.data;
        this.db.removeDoc(doc,
            { success:
                function() {
                    that.requestOutstanding = false;
                    delete that.persistedDocs[doc._id];
                    that.requestQueue.shift();
                    that.sync();
                },
              error:
                function() {
                    that.requestOutstanding = false;
                    setTimeout(function() { that.sync(); }, 1000);
                }
            }
        );
        break;
    };
}

VertexIO.prototype.login = function(username, password, onSuccess, onError) {
    var that = this;
    $.couch.login({
            "name": username,
            "password": password,
            success: function() {
                that.username = username;
                if(onSuccess) onSuccess();
            },
            error: onError
        });
}

VertexIO.prototype.signup = function(username, password, onSuccess, onError) {
    var that = this;
    $.couch.signup({name: username}, password, {
        success: function() {
            that.username = username;
            if(onSuccess) onSuccess();
        },
        error: onError
    });
}

VertexIO.prototype.load = function(id, onLoad, onError) {
    var that = this;
    this.db.openDoc(id, {success:
                            function(doc) {
                                that.localDocs[doc._id] = doc;
                                that.persistedDocs[doc._id] = true;
                                if(onLoad) {
                                    onLoad(doc);
                                }
                            },
                         error: onError
                        }
                    );
}

VertexIO.prototype.create = function(id, obj) {
    obj._id = id;
    this.localDocs[obj._id] = obj;
    this.requestQueue.push({type: "save", data: obj});
    this.sync();
    return obj;
}

VertexIO.prototype.update = function(obj) {
    if(!obj._id)
        return false;//TODO: throw?

    this.localDocs[obj._id] = obj;
    this.requestQueue.push({type: "save", data: obj});
    this.sync();
    return obj;
}

VertexIO.prototype.remove = function(obj) {
    if(!obj._id)
        return false;//TODO: throw?

    var doc = this.localDocs[obj._id];
    delete this.localDocs[obj._id];
    this.requestQueue.push({type: "remove", data: doc});
    this.sync();
}
