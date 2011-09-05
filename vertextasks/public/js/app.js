$.couch.app(function(app) {
    var vertexio = new VertexIO({dbName: "vertextasks"});
    var taskList = {};
    var tasks = {};
    var completed = {};
    var taskListView = $("#list-tasks");
    var completedListView = $("#list-completed");
    completedListView.listview();

    function displayTask(task) {
        taskListView.append("<li task-id='" + task._id + "' task-name='" + task.name + "' data-split-icon='delete'><a class='a-edit-task'>" + task.name + "</a><a class='a-delete-task'>Delete</a></li>");
        taskListView.listview("refresh");
        $(".a-edit-task").unbind("click").click(function() {
            var taskName = $(this).text();
            $("#task-detail-name").text(task.name);
            $("#task-detail-desc").text(task.description);
            $.mobile.changePage("page-task-edit");
        });
        $(".a-delete-task").unbind("click").click(function() {
            var taskName = $(this).parent().attr("task-name");
            deleteTask(taskName);
            $(this).parent().remove();
            taskListView.listview("refresh");
            completedListView.append("<li>" + taskName + "</li>");
            completedListView.listview("refresh");
        });
    }

    var downloadAndDisplayTask = function(taskName) {
        vertexio.load(taskName,
                      function(task) {
                        tasks[taskName] = task;
                        displayTask(task);
                      }
        );
    }

    vertexio.login("vertex", "io",
        function() {
            vertexio.load(vertexio.username + ":taskList",
                function(doc) {
                    taskList = doc;
                    for(var cur in taskList.tasks) {
                        downloadAndDisplayTask(taskList.tasks[cur]);
                    }
                },
                function() {
                    taskList = vertexio.create(vertexio.username + ":taskList", {type: "task_list", tasks: [], completed: []});
                }
            );
        },
        function() {
            vertexio.signup("vertex", "io")
        }
    );

    //hack to keep in sync. TODO: make it nice/simple
    setInterval(function() {
        vertexio.load(vertexio.username + ":taskList",
            function(doc) {
                taskList = doc;
                //load tasks we dont have
                for(var cur in taskList.tasks) {
                    var taskName = taskList.tasks[cur];
                    if(!tasks[taskName]) {
                        downloadAndDisplayTask(taskName);
                    }
                }
                //delete tasks the server doesnt have
                for(cur in tasks) {
                    if(_.indexOf(taskList.tasks, cur) < 0) {
                        var taskName = cur;
                        taskList.tasks.splice(_.indexOf(taskList.tasks, taskName), 1);
                        delete tasks[taskName];
                        taskListView.children("li").each(function() {
                            if($(this).attr("task-id") == taskName) {
                                completedListView.append("<li>" + $(this).attr("task-name") + "</li>");
                                completedListView.listview("refresh");
                                $(this).remove();
                            }
                        });
                        taskListView.listview("refresh");
                    }
                }
            },
            function() {
                //nothing
            }
        );
    }, 1000);
    

    function addTask(name, desc) {
        var taskName = vertexio.username + ":task:" + name;
        var ret = vertexio.create(taskName, {type: "task", "name": name, description: desc});
        tasks[taskName] = ret;
        taskList.tasks.push(taskName);
        vertexio.update(taskList);
        return ret;
    }

    function deleteTask(name) {
        var taskName = vertexio.username + ":task:" + name;
        taskList.tasks.splice(_.indexOf(taskList.tasks, taskName), 1);
        vertexio.update(taskList);
        vertexio.remove(tasks[taskName]);
        delete tasks[taskName];
    }

    $("#button-show-completed").click(function() {
        $.mobile.changePage("page-completed", "slide");
    });

    $("#button-show-tasks").click(function() {
        $.mobile.changePage("page-tasks", "slide", true);
    });

    $("#button-new-task").click(function() {
        $.mobile.changePage("page-new-task", "slideup");
    });

    $("#button-new-task-create").click(function() {
        var taskName = $("#new-task-name").val();
        var taskDesc = $("#new-task-desc").val();
        var task = addTask(taskName, taskDesc);
        displayTask(task);
        $.mobile.changePage("page-tasks", "slidedown");
    });
});