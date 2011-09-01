/**
 * _watchdog_util.c: Common routines and global data used by _watchdog_fsevents.
 *
 * Copyright (C) 2009, 2010 Malthe Borch <mborch@gmail.com>
 * Copyright (C) 2010 Yesudeep Mangalapilly <yesudeep@gmail.com>
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 */

#include "_watchdog_fsevents.h"

static void
Watchdog_FSEventStream_Callback(ConstFSEventStreamRef stream,
                                StreamCallbackInfo *stream_callback_info,
                                const size_t num_events,
                                const char * const event_paths[],
                                const FSEventStreamEventFlags event_flags[],
                                const FSEventStreamEventId event_ids[]);

static CFMutableArrayRef
Watchdog_CFMutableArray_FromStringList(PyObject *py_string_list);


/**
 * Dictionary that maps an emitter thread to a :class:`CFRunLoop` instance.
 */
static PyObject *g__runloop_for_emitter = NULL;


/**
 * Dictionary that maps an :class:`watchdog.observers.api.ObservedWatch` to an
 * FSEvent stream.
 */
static PyObject *g__stream_for_watch = NULL;


/**
 * Initializes data structures for the _watchdog_fsevents Python module.
 * This function is called by Python initializer functions.
 */
void
Watchdog_FSEvents_Init(void)
{
    g__runloop_for_emitter = PyDict_New();
    g__stream_for_watch = PyDict_New();
}


/**
 * Obtains the run loop for a given emitter thread from the
 * runloop-for-emitter dictionary.
 *
 * :param emitter_thread:
 *     The emitter thread for which to obtain the run loop.
 * :type emitter_thread:
 *     A pointer to a Python object representing the emitter thread.
 * :returns:
 *     A pointer to a :class:`CFRunLoop`
 */
CFRunLoopRef
Watchdog_CFRunLoopForEmitter_GetItem(PyObject *emitter_thread)
{
    PyObject *py_runloop = PyDict_GetItem(g__runloop_for_emitter,
                                          emitter_thread);
    CFRunLoopRef runloop = PyCObject_AsVoidPtr(py_runloop);
    return runloop;
}


/**
 * Associates an emitter thread with a run loop.
 *
 * :param emitter_thread:
 *     The emitter thread which will be used as key.
 * :type emitter_thread:
 *     A pointer to a Python object representing the emitter thread.
 * :param runloop:
 *     The runloop which will be used as the value.
 * :type runloop:
 *     A pointer to the :class:`CFRunLoop`.
 */
int
Watchdog_CFRunLoopForEmitter_SetItem(PyObject *emitter_thread,
                                     CFRunLoopRef runloop)
{
    PyObject *emitter_runloop = PyCObject_FromVoidPtr(runloop, PyMem_Free);
    // refcount(emitter_runloop) = 1
    // refcount(emitter_thread) = 1

    int retval = PyDict_SetItem(g__runloop_for_emitter,
                                emitter_thread,
                                emitter_runloop);
    if (0 > retval)
        {
            // refcount(emitter_thread) = 1
            // Don't decref the emitter thread that belongs to Python land.
            // refcount(emitter_runloop) = 1
            Py_DECREF(emitter_runloop);
            // refcount(emitter_runloop) = 0
            return retval;
        }
    // else success!
    //      refcount(emitter_runloop) = 2
    //      and refcount(emitter_thread) = 2

    return retval;
}


/**
 * Removes an entry from the runloop-for-emitter dictionary for the given
 * emitter thread.
 *
 * :param emitter_thread:
 *     The emitter thread for which the dictionary entry will be removed.
 * :type emitter_thread:
 *     A pointer to a Python object representing the emitter thread.
 * :returns:
 *     The same as :func:`PyDict_DelItem`
 */
int
Watchdog_CFRunLoopForEmitter_DelItem(PyObject *emitter_thread)
{
    CFRunLoopRef emitter_runloop = NULL;
    int return_value = 0;
    // refcount(emitter_thread) = 2
    // refcount(emitter_runloop) = 2
    // from previous successful addition to the dict.
    emitter_runloop = PyDict_GetItem(g__runloop_for_emitter, emitter_thread);
    RETURN_IF(NULL == emitter_runloop);

    return_value = PyDict_DelItem(g__runloop_for_emitter, emitter_thread);
    if (0 == return_value)
        {
            // Success!
            // refcount(emitter_thread) = 1
            // refcount(emitter_runloop) = 1
            Py_DECREF(emitter_runloop);
            // refcount(emitter_runloop) = 0
            // refcount(emitter_thread) = 1
            // back to python land.
        }
    return return_value;
}


/**
 * Determines whether the runloop-for-emitter dictionary contains an entry
 * for the given emitter thread.
 *
 * :param emitter_thread:
 *     The emitter thread for which an association is checked.
 * :type emitter_thread:
 *     A pointer to a Python object representing the emitter thread.
 * :returns:
 *     The same as :func:``PyDict_Contains``
 */
int
Watchdog_CFRunLoopForEmitter_Contains(PyObject *emitter_thread)
{
    return PyDict_Contains(g__runloop_for_emitter, emitter_thread);
}


/**
 * Get run loop reference from emitter info data or current run loop.
 *
 * :param emitter_thread:
 *     The thread for which to obtain the runloop.
 * :type emitter_thread:
 *     A pointer to a Python object.
 * :returns:
 *     A pointer of type ``CFRunLoopRef`` to a runloop.
 */
CFRunLoopRef
Watchdog_CFRunLoopForEmitter_GetItemOrDefault(PyObject *emitter_thread)
{
    PyObject *py_runloop = NULL;
    CFRunLoopRef runloop = NULL;

    py_runloop = PyDict_GetItem(g__runloop_for_emitter, emitter_thread);
    if (NULL == py_runloop)
        {
            runloop = CFRunLoopGetCurrent();
        }
    else
        {
            runloop = PyCObject_AsVoidPtr(py_runloop);
        }

    return runloop;
}


/**
 * Associates a stream with a watch in the stream-for-watch dictionary.
 *
 * :param watch:
 *     The watch that will be used as a key. The Python object representing
 *     the watch must be immutable and hashable to be used as a key.
 * :type watch:
 *     Pointer to a Python object preferably of type:
 *     :class:`watchdog.observers.api.ObservedWatch`
 * :param stream:
 *     The stream which will be associated with the watch key.
 * :returns:
 *     The same as :func:`PyDict_SetItem`
 */
int
Watchdog_StreamForWatch_SetItem(PyObject *watch, FSEventStreamRef stream)
{
    int retval = 0;
    PyObject *py_stream = PyCObject_FromVoidPtr(stream, PyMem_Free);

    retval = PyDict_SetItem(g__stream_for_watch, watch, py_stream);
    if (0 > retval)
        {
            Py_DECREF(py_stream);
            return retval;
        }
    return retval;
}


/**
 * Obtains the stream for a given watch from the stream-for-watch dictionary.
 *
 * :param watch:
 *     The watch for which to obtain the stream.
 * :type watch:
 *     Pointer to a Python object preferably of type:
 *     :class:`watchdog.observers.api.ObservedWatch`
 * :returns:
 *     A pointer to the Python object representing the stream associated with
 *     the given watch.
 */
FSEventStreamRef
Watchdog_StreamForWatch_GetItem(PyObject *watch)
{
    PyObject *py_stream = PyDict_GetItem(g__stream_for_watch, watch);
    FSEventStreamRef stream = PyCObject_AsVoidPtr(py_stream);
    return stream;
}


/**
 * Deletes the key-value (watch-stream) entry for the given watch from the
 * stream-for-watch dictionary.
 *
 * :param watch:
 *     A pointer to the watch for which the dictionary entry will be removed.
 * :type watch:
 *     Pointer to a Python object preferably of type:
 *     :class:`watchdog.observers.api.ObservedWatch`
 * :returns:
 *     The same as :func:`PyDict_DelItem`
 */
int
Watchdog_StreamForWatch_DelItem(PyObject *watch)
{
    return PyDict_DelItem(g__stream_for_watch, watch);
}


/**
 * Pops (removes and returns) a stream for the given watch from the
 * stream-for-watch dictionary.
 *
 * :param watch:
 *     The watch for which to obtain the associated stream.
 * :type watch:
 *     Pointer to a Python object preferably of type:
 *     :class:`watchdog.observers.api.ObservedWatch`
 * :returns:
 *     The stream associated with the given watch.
 */
FSEventStreamRef
Watchdog_StreamForWatch_PopItem(PyObject *watch)
{
    FSEventStreamRef stream = Watchdog_StreamForWatch_GetItem(watch);
    if (stream)
        {
            Watchdog_StreamForWatch_DelItem(watch);
        }
    return stream;
}


/**
 * Determines whether the stream-for-watch dictionary contains a given
 * watch object.
 *
 * :param watch:
 *     Python object representing an observed watch.
 * :type watch:
 *     Pointer to a Python object preferably of type:
 *     :class:`watchdog.observers.api.ObservedWatch`
 * :returns:
 *     The same as :func:`PyDict_Contains`
 */
int
Watchdog_StreamForWatch_Contains(PyObject *watch)
{
    return PyDict_Contains(g__stream_for_watch, watch);
}

/**
 * Converts a Python string list to a :class:`CFMutableArray` of UTF-8 encoded
 * :class:`CFString` and returns a pointer to the array.
 *
 * :param py_string_list:
 *     Python list of Python strings.
 * :type py_string_list:
 *     Pointer to a Python object.
 * :returns:
 *     A :class:`CFMutableArrayRef` (pointer to a mutable array) of
 *     UTF-8-encoded :class:`CFString` instances.
 */
static CFMutableArrayRef
Watchdog_CFMutableArray_From_PyStringList(PyObject *py_string_list)
{
    CFMutableArrayRef array_of_cf_string = NULL;
    CFStringRef cf_string = NULL;
    PyObject *py_string = NULL;
    const char *c_string = NULL;
    Py_ssize_t i = 0;
    Py_ssize_t string_list_size = 0;

    RETURN_NULL_IF_NULL(py_string_list);
    string_list_size = PyList_Size(py_string_list);

    /* Allocate a CFMutableArray */
    array_of_cf_string = CFArrayCreateMutable(kCFAllocatorDefault,
                                              1,
                                              &kCFTypeArrayCallBacks);
    RETURN_NULL_IF_NULL(array_of_cf_string);

    /* Loop through the Python string list and copy strings to the
     * CFString array list. */
    for (i = 0; i < string_list_size; ++i)
        {
            py_string = PyList_GetItem(py_string_list, i);
            c_string = PyString_AS_STRING(py_string);
            cf_string = CFStringCreateWithCString(kCFAllocatorDefault,
                                                  c_string,
                                                  kCFStringEncodingUTF8);
            CFArraySetValueAtIndex(array_of_cf_string, i, cf_string);
            CFRelease(cf_string);
        }

    return array_of_cf_string;
}

/**
 * Creates an ``FSEventStream`` event stream and returns a reference to it.
 *
 * :param stream_callback_info:
 *      The stream callback information that will be passed to the callback
 *      by the FSEvents API when it is called.
 * :type stream_callback_info:
 *      Pointer to a :struct:`StreamCallbackInfo` struct.
 * :param py_pathnames:
 *      Python list of Python string paths.
 * :type py_pathnames:
 *      A pointer to a Python object.
 * :returns:
 *      A pointer to an ``FSEventStream`` representing the event stream.
 */
FSEventStreamRef
Watchdog_FSEventStream_Create(StreamCallbackInfo *stream_callback_info,
                              PyObject *py_pathnames)
{
    CFMutableArrayRef pathnames = NULL;
    FSEventStreamRef stream = NULL;
    CFAbsoluteTime stream_latency = FS_EVENT_STREAM_LATENCY;

    /* Convert the path list to an array for OS X API. */
    RETURN_NULL_IF_NULL(py_pathnames);
    pathnames = Watchdog_CFMutableArray_From_PyStringList(py_pathnames);
    RETURN_NULL_IF_NULL(pathnames);

    /* Create event stream. */
    FSEventStreamContext stream_context =
        { 0, stream_callback_info, NULL, NULL, NULL };
    stream = FSEventStreamCreate(kCFAllocatorDefault,
                                 (FSEventStreamCallback)
                                    &Watchdog_FSEventStream_Callback,
                                 &stream_context,
                                 pathnames,
                                 kFSEventStreamEventIdSinceNow,
                                 stream_latency,
                                 kFSEventStreamCreateFlagNoDefer);
    CFRelease(pathnames);
    return stream;
}


/**
 * FSEvents event stream callback function called by the FSEvents API in
 * response to each file system event.
 *
 * This callback handler in turn calls our Python callback which is used
 * in the API layers above to dispatch events to appropriate event handlers.
 *
 * .. ADMONITION:: Handling callback failure
 *    If calling the Python callback function fails for any reason, the run loop
 *    associated with the given stream is stopped and hence monitoring will be
 *    shut down.
 *
 * .. ADMONITION:: Thread synchronization
 *    This method acquires the GIL on entry and releases it on exit.
 *
 * :param stream:
 *     The stream for which to call this handler.
 * :type stream:
 *     A pointer to an ``FSEventStream``.
 * :param stream_callback_info
 *     Information that will be supplied by FSEvents to the callback when it
 *     is called.
 * :type stream_callback_info:
 *     A pointer to a ``StreamCallbackInfo`` struct. This information is passed
 *     to this callback function by the stream run loop.
 * :param num_events:
 *     The number of events reported by the FSEvents stream.
 * :param event_paths:
 *     C strings of event source paths.
 * :param event_flags:
 *     Stream event flags for a given event.
 * :type event_flags:
 *     An array of ``uint32_t`` event flags.
 * :param event_ids:
 *     Stream event IDs for the given event.
 * :type event_ids:
 *     An array of ``uint64_t`` event ids.
 */
static void
Watchdog_FSEventStream_Callback(ConstFSEventStreamRef stream,
                                StreamCallbackInfo *stream_callback_info,
                                const size_t num_events,
                                const char * const event_paths[],
                                const FSEventStreamEventFlags event_flags[],
                                const FSEventStreamEventId event_ids[])
{
    PyThreadState *saved_thread_state = NULL;
    PyObject *event_path = NULL;
    PyObject *event_flag = NULL;
    PyObject *event_path_list = NULL;
    PyObject *event_flag_list = NULL;
    size_t i = 0;

    /* Acquire lock and save thread state. */
    PyEval_AcquireLock();
    saved_thread_state = PyThreadState_Swap(stream_callback_info->thread_state);

    /* Create Python lists that will contain event paths and flags. */
    event_path_list = PyList_New(num_events);
    event_flag_list = PyList_New(num_events);

    RETURN_IF_NOT(event_path_list && event_flag_list);

    /* Enumerate event paths and flags into Python lists. */
    for (i = 0; i < num_events; ++i)
        {
            event_path = PyString_FromString(event_paths[i]);
            event_flag = PyInt_FromLong(event_flags[i]);
            if (!(event_flag && event_path))
                {
                    Py_DECREF(event_path_list);
                    Py_DECREF(event_flag_list);
                    return;
                }
            PyList_SET_ITEM(event_path_list, i, event_path);
            PyList_SET_ITEM(event_flag_list, i, event_flag);
        }

    /* Call the callback event handler function with the enlisted event flags
     * and paths as arguments. On failure check whether an error occurred and
     * stop this instance of the run loop.
     */
    if (NULL == PyObject_CallFunction(stream_callback_info->callback,
                                      "OO",
                                      event_path_list,
                                      event_flag_list))
        {
            /* An exception may have occurred. */
            if (!PyErr_Occurred())
                {
                    /* If one didn't occur, raise an exception informing that
                     * we could not execute the callback function. */
                    PyErr_SetString(PyExc_ValueError,
                                    ERROR_MESSAGE_CANNOT_CALL_CALLBACK);
                }

            /* Stop listening for events. */
            CFRunLoopStop(stream_callback_info->runloop);
        }

    /* Restore original thread state and release lock. */
    PyThreadState_Swap(saved_thread_state);
    PyEval_ReleaseLock();
}
