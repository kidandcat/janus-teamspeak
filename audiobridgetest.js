var server = "https://janus.netelip.com:8088/janus";
var janus = null;
var mixertest = null;
var myusername = prompt('Username');
var roomOfRooms = 'netelip';
var myid = null;
var webrtcUp = false;


Janus.init({
    //debug: "all",
    debug: false,
    callback: function() {
        if (!Janus.isWebrtcSupported()) {
            alert("No WebRTC support... ");
            return;
        }
        janus = new Janus({
            server: server,
            success: function() {
                janus.attach({
                    plugin: "janus.plugin.audiobridge",
                    success: function(pluginHandle) {
                        mixertest = pluginHandle;
                        Janus.log("Plugin attached! (" + mixertest.getPlugin() + ", id=" + mixertest.getId() + ")");
                        registerUsername(myusername);
                    },
                    error: function(error) {
                        Janus.error("  -- Error attaching plugin...", error);
                    },
                    consentDialog: function(on) {
                        Janus.debug("Consent dialog should be " + (on ? "on" : "off") + " now");
                    },
                    onmessage: function(msg, jsep) {
                        Janus.debug(" ::: Got a message :::");
                        Janus.debug(JSON.stringify(msg));
                        var event = msg["audiobridge"];
                        Janus.debug("Event: " + event);
                        if (event != undefined && event != null) {
                            if (event === "joined") {
                                myid = msg["id"];
                                Janus.log("Successfully joined room " + msg["room"] + " with ID " + myid);
                                if (!webrtcUp) {
                                    webrtcUp = true;
                                    mixertest.createOffer({
                                        media: {
                                            video: false
                                        }, // This is an audio only room
                                        success: function(jsep) {
                                            Janus.debug("Got SDP!");
                                            Janus.debug(jsep);
                                            var publish = {
                                                "request": "configure",
                                                "muted": false
                                            };
                                            mixertest.send({
                                                "message": publish,
                                                "jsep": jsep
                                            });
                                        },
                                        error: function(error) {
                                            Janus.error("WebRTC error:", error);
                                        }
                                    });
                                }
                                if (msg["participants"] !== undefined && msg["participants"] !== null) {
                                    var list = msg["participants"];
                                    Janus.debug("Got a list of participants:");
                                    Janus.debug(list);
                                    for (var f in list) {
                                        var id = list[f]["id"];
                                        var display = list[f]["display"];
                                        var muted = list[f]["muted"];
                                        Janus.debug("  >> [" + id + "] " + display + " (muted=" + muted + ")");
                                    }
                                }
                            } else if (event === "roomchanged") {
                                myid = msg["id"];
                                Janus.log("Moved to room " + msg["room"] + ", new ID: " + myid);
                                if (msg["participants"] !== undefined && msg["participants"] !== null) {
                                    var list = msg["participants"];
                                    Janus.debug("Got a list of participants:");
                                    Janus.debug(list);
                                    for (var f in list) {
                                        var id = list[f]["id"];
                                        var display = list[f]["display"];
                                        var muted = list[f]["muted"];
                                        Janus.debug("  >> [" + id + "] " + display + " (muted=" + muted + ")");
                                    }
                                }
                            } else if (event === "destroyed") {
                                Janus.warn("The room has been destroyed!");
                                alert("The room has been destroyed");
                                window.location.reload();
                            } else if (event === "event") {
                                if (msg["participants"] !== undefined && msg["participants"] !== null) {
                                    var list = msg["participants"];
                                    Janus.debug("Got a list of participants:");
                                    Janus.debug(list);
                                    for (var f in list) {
                                        var id = list[f]["id"];
                                        var display = list[f]["display"];
                                        var muted = list[f]["muted"];
                                        Janus.debug("  >> [" + id + "] " + display + " (muted=" + muted + ")");
                                    }
                                } else if (msg["error"] !== undefined && msg["error"] !== null) {
                                    alert(msg["error"]);
                                    return;
                                }
                                if (msg["leaving"] !== undefined && msg["leaving"] !== null) {
                                    var leaving = msg["leaving"];
                                    Janus.log("Participant left: " + leaving + " (we have " + $('#rp' + leaving).length + " elements with ID #rp" + leaving + ")");
                                }
                            }
                        }
                        if (jsep !== undefined && jsep !== null) {
                            Janus.debug("Handling SDP as well...");
                            Janus.debug(jsep);
                            mixertest.handleRemoteJsep({
                                jsep: jsep
                            });
                        }
                        update();
                    },
                    onlocalstream: function(stream) {
                        Janus.debug(" ::: Got a local stream :::");
                        Janus.debug(JSON.stringify(stream));
                    },
                    onremotestream: function(stream) {
                        document.querySelector('.sound').innerHTML = '<audio class="rounded centered" id="roomaudio" width="100%" height="100%" autoplay/>';
                        attachMediaStream(document.querySelector('#roomaudio'), stream);
                    },
                    oncleanup: function() {
                        webrtcUp = false;
                        Janus.log(" ::: Got a cleanup notification :::");
                    }
                });
            },
            error: function(error) {
                Janus.error(error);
                alert(error);
            },
            destroyed: function() {
                window.location.reload();
            }
        });
    }
});


function registerUsername(username) {
    myusername = username;
}

function joinRoom(room) {
    var register = {
        "request": "join",
        "room": room,
        "display": myusername,
    };
    mixertest.send({
        "message": register,
        "success": function(rom) {
            console.log('Joined ', rom);
        }
    });
}

function createRoom(name) {
    var create = {
        "request": "create",
        "permanent": false,
        "description": roomOfRooms + ':-:' + name,
    };
    mixertest.send({
        "message": create,
        "success": function(rom) {
            console.log('Room created ' + rom.room);
            update();
        }
    });
}

function destroyRoom(id, password) {
    var create = {
        "request": "destroy",
        "room": Number(id),
        "permanent": true,
        "secret": password || ''
    };
    console.log(create);
    mixertest.send({
        "message": create,
        "success": function(rom) {
            console.log('Room destroyed ', rom);
            update();
        }
    });
}

function changeRoom(room) {
    var register = {
        "request": "changeroom",
        "room": room,
        "display": myusername,
    };
    mixertest.send({
        "message": register
    });
}

function participants(room, cb) {
    var register = {
        "request": "listparticipants",
        "room": room
    };
    mixertest.send({
        "message": register,
        "success": function(res) {
            cb(res.participants);
        }
    });
}

function listRooms(cb) {
    var msg = {
        "request": "list"
    };
    mixertest.send({
        "message": msg,
        "success": function(a) {
            var res = [];
            a.list.forEach(function(rom){
              if(rom.description.split(':-:')[0] == roomOfRooms || roomOfRooms == 'theMagicWord'){
                rom.description = (roomOfRooms == 'theMagicWord')?rom.description:rom.description.split(':-:')[1];
                res.push(rom);
              }
            });
            res.sort(function(a, b) {
                return b.description < a.description;
            });
            cb(res);
        }
    });
}
