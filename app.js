var ArtikCloud = require('artikcloud-js');
var passport = require('passport');
var OAuth2Strategy = require('passport-oauth2').Strategy;
var fs = require('fs');
var express = require('express');
var nunjucks = require('nunjucks');
var path = require('path');
var favicon = require('serve-favicon');
var logger = require('morgan');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var session = require('express-session');
var uuid = require('node-uuid');
var async = require('async');

var routes = require('./routes/index');
var users = require('./routes/users');

//
// Configuration
//
try {
    var file = fs.readFileSync("config.json", "utf8");
    var config = JSON.parse(file);

    if (config.debug) {
      console.log(JSON.stringify(config));
    }

    var deviceTypes = config.devices;

    if (config.debug) {
      console.log(deviceTypes);
    }
} catch(e) {
    console.error("File config.json not found or is invalid. " + e);
    process.exit(1);
}

//
// ArtikCloud OAuth2 Setup
// Create an Application with the callback URL: http://localhost:4444/login/artikcloud/callback
// Copy the clientID and clientSecret in config.json
//
passport.use(
  new OAuth2Strategy(
    {
      authorizationURL: 'https://accounts.artik.cloud/authorize',
      tokenURL: 'https://accounts.artik.cloud/token',
      clientID: config.oauth.clientID,
      clientSecret: config.oauth.clientSecret,
      callbackURL: config.oauth.callbackURL
    },
    function(accessToken, refreshToken, profile, callback) {
      console.log(accessToken + ", " + refreshToken);
      var _defaultClient = new ArtikCloud.ApiClient();
      _defaultClient.authentications['artikcloud_oauth'].accessToken = accessToken;
      var _usersApi = new ArtikCloud.UsersApi(_defaultClient);
      _usersApi.getSelf(
        // User info found
        function (error, user) {
          if (error) {
            console.log("Couldnt retrieve User Profile: " + error);
            callback(error, null);
          } else {
            // Store the User Profile with the Tokens in the callback data
            var data = user.data;
            data.accessToken = accessToken;
            data.refreshToken = refreshToken;

            if (config.debug) {
              console.log("Got User information: " + JSON.stringify(data));
            }
            callback(null, data);
          }
        }
      );
    }
  )
);

passport.serializeUser(function(user, callback) {
  callback(null, user);
});

passport.deserializeUser(function(obj, callback) {
  callback(null, obj);
});

var app = express();

// view engine setup
app.use(express.static('public'))
nunjucks.configure('views', {
  autoescape: false,
  express: app,
  watch: true,
  noCache: true
});

// uncomment after placing your favicon in /public
//app.use(favicon(path.join(__dirname, 'public', 'favicon.ico')));
app.use(logger('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));
app.use(session({
  genid: function(req) {
    return uuid.v1() // use UUIDs for session IDs
  },
  resave: false,
  saveUninitialized: true,
  secret: config.sessionSecret,
  cookie: {} // secure cookies should be enabled with https
}));

// Initialize Passport and restore authentication state, if any, from the session.
app.use(passport.initialize());
app.use(passport.session());

//app.use('/', routes);
//app.use('/users', users);

app.get('/',
  function(req, res) {
    if (!req.user) {
      res.redirect('/login');
    } else {
      res.redirect('/profile');
    }
  }
);

app.get('/login', function(req, res) {
    res.render('login.html')
  }
);

app.get('/logout', function(req, res){
  req.logout();
  res.redirect('/');
});

app.get('/login/artikcloud', passport.authenticate('oauth2'));

app.get('/login/artikcloud/callback',
  passport.authenticate('oauth2', { failureRedirect: '/login/artikcloud'}),
  function(req, res) {
    res.redirect('/');
  }
);

function isAuthenticated(req, res, next){
  if (req.hasOwnProperty("user") && req.user.hasOwnProperty("accessToken")) {
    next();
  } else {
    res.redirect("/login");
  }
}

app.get('/profile',
  isAuthenticated,
  function(req, res) {
    res.render('profile.html', { user: req.user });
  }
);

app.post('/actions',
  isAuthenticated,
  function(req, res) {
    console.log(JSON.stringify(req.body));
    var data = {
      lat: parseFloat(req.body.lat),
      long: parseFloat(req.body.long)
    };
    console.log("Location Data: " + JSON.stringify(data));

    var _defaultClient = new ArtikCloud.ApiClient();
    _defaultClient.authentications['artikcloud_oauth'].accessToken = req.user.accessToken;
    var _usersApi = new ArtikCloud.UsersApi(_defaultClient);
    var _messagesApi = new ArtikCloud.MessagesApi(_defaultClient);
    _usersApi.getUserDevices(req.user.id, {}, function(error, response) {
      if (error) throw error;
      var devices = {};

      var sdids = "";
      for (var j = 0; j < response.count; j++) {
        var device = response.data.devices[j];
        if (device.dtid === "dt9ad7ecfd34324765a9b12ef98a51b29e") {
          var ddid = device.id;
          if (config.debug) {
            console.log("Found Open Weather Map Device: " + ddid);
          }

          var action =
          [
            {
              "name": "getCurrentWeatherByGPSLocation",
              "parameters": data
            }
          ];

          var action = {
            ddid: ddid,
            type: "action",
            ts: new Date().getTime(),
            data: {
              actions: action
            }
          };

          _messagesApi.sendActions(action, function(error, response) {
            if (error) {
              console.error("Error sending action: " + JSON.stringify(error));
            } else {
              if (config.debug) {
                console.log("Sent action " + JSON.stringify(response));
              }

              // Re-direct to GET /messages
              res.redirect('/messages');
            }
          });
        }
      }
    });
  }
);

app.post('/messages',
  isAuthenticated,
  function(req, res) {
    console.log(JSON.stringify(req.body));
    var data = {
      steps: parseInt(req.body.steps),
      distance: parseFloat(req.body.distance)
    };
    console.log("Pedometer Data: " + JSON.stringify(data));

    var _defaultClient = new ArtikCloud.ApiClient();
    _defaultClient.authentications['artikcloud_oauth'].accessToken = req.user.accessToken;
    var _usersApi = new ArtikCloud.UsersApi(_defaultClient);
    var _messagesApi = new ArtikCloud.MessagesApi(_defaultClient);
    _usersApi.getUserDevices(req.user.id, {}, function(error, response) {
      if (error) throw error;
      var devices = {};

      var sdids = "";
      for (var j = 0; j < response.count; j++) {
        var device = response.data.devices[j];
        if (device.dtid === "dta8ad42083f33441b8677e5b36f049a4b") {
          var sdid = device.id;
          if (config.debug) {
            console.log("Found Pedometer Device: " + sdid);
          }

          var message = {
            sdid: sdid,
            type: "message",
            ts: new Date().getTime(),
            data: data
          };

          _messagesApi.sendMessage(message, function(error, response) {
            if (error) {
              console.error("Error sending messages: " + JSON.stringify(error));
            } else {
              if (config.debug) {
                console.log("Sent messages " + JSON.stringify(response));
              }

              // Re-direct to GET /messages
              res.redirect('/messages');
            }
          });
        }
      }
    });
  }
);

app.get('/messages',
  isAuthenticated,
  function(req, res) {
    var _defaultClient = new ArtikCloud.ApiClient();
    _defaultClient.authentications['artikcloud_oauth'].accessToken = req.user.accessToken;
    if (config.debug) {
      console.log("GET /messages: " + req.user.accessToken + ", user: " + req.user.id);
    }
    var _usersApi = new ArtikCloud.UsersApi(_defaultClient);
    var _messagesApi = new ArtikCloud.MessagesApi(_defaultClient);
    _usersApi.getUserDevices(req.user.id, {}, function(error, response) {
      if (error) throw error;
      var devices = {};

      var sdids = "";
      for (var j = 0; j < response.count; j++) {
        var device = response.data.devices[j];
        if (device.dtid in deviceTypes) {
          // Add to list of found device
          devices[device.id] = device;
          devices[device.id].dt = deviceTypes[device.dtid];
          if (sdids.length > 0) {
            sdids = sdids + ",";
          }
          sdids = sdids + device.id;
        }
      }

      if (config.debug) {
        console.log("Found Matching Devices: " + sdids);
        console.log("Devices " + JSON.stringify(devices));
      }
      var opts = {
        count: 5,
        sdids: sdids
      }
      _messagesApi.getLastNormalizedMessages(opts, function(error, response) {
        if (error) {
          console.error("Error retrieving normalized messages: " + JSON.stringify(error));
        } else {
          if (config.debug) {
            console.log("Found normalized messages " + JSON.stringify(response));
          }

          var messages = response.data;
          // Embellish the messages with Device Information
          for (var index = 0; index < messages.length; index++) {
            var message = messages[index];
            message.dt = devices[message.sdid].dt;
            message.data2 = getReadableData(message);
            message.time = new Date(message.ts).toISOString();
          }

          res.render('messages.html', { user: req.user, messages: messages});
        }
      });
    });
  }
);

function getReadableData(message) {
  var data = message.data;
  switch (message.dt.name) {
    case "openweathermap":
      return data.name + " : <b>" + data.main.temp + " F</b>  <img src='http://openweathermap.org/img/w/" + data.weather.icon + ".png'/>";
    case "mypedometer":
      return "Travelled: <b>" + data.distance + " miles</b>, Step Count: <b>" + data.steps + "</b>";
    case "jawbone":
    case "fitbit":
    case "misfit":
      return JSON.stringify(data);
  }

  return JSON.stringify(data);
}

app.get('/devices',
  isAuthenticated,
  function(req, res) {
    var _defaultClient = new ArtikCloud.ApiClient();
    _defaultClient.authentications['artikcloud_oauth'].accessToken = req.user.accessToken;
    var _usersApi = new ArtikCloud.UsersApi(_defaultClient);
    var _devicesApi = new ArtikCloud.DevicesApi(_defaultClient);
    _usersApi.getUserDevices(req.user.id, {}, function(error, response) {
      if (error) {
        console.error(error + ", " + JSON.stringify(error));
        //throw new Error("Couldnt Get User Devices");
      } else {
        var devices = {};
        var missingDeviceTypes = JSON.parse(JSON.stringify(deviceTypes));
        //var missingDtIds = Object.keys(deviceTypes);
        if (config.debug) {
          console.log("Initial Device Types: " + missingDeviceTypes);
        }
        for (var j = 0; j < response.count; j++) {
          var device = response.data.devices[j];
          if (device.dtid in deviceTypes) {
            // Add to list of found device
            devices[device.id] = device;
            // Remove from list of missing DeviceType IDs
            delete missingDeviceTypes[device.dtid];
          }
        }

        if (config.debug) {
          console.log("Found Devices: " + JSON.stringify(devices));
          console.log("Missing Device Types: " + JSON.stringify(missingDeviceTypes));
        }

        var dtIdsToCreate = Object.keys(missingDeviceTypes);
        async.each(dtIdsToCreate,
          function(dtIdToCreate, callback) {
            var deviceParams = {
              uid: req.user.id,
              dtid: dtIdToCreate,
              name: dtIdToCreate,
              manifestVersionPolicy: "LATEST"
            };
            if (config.debug) {
              console.log("Creating device: " + JSON.stringify(deviceParams));
            }
            _devicesApi.addDevice(deviceParams, function(error, response) {
              if (error) {
                console.error("Error creating device: " + error);
              } else {
                if (config.debug) {
                  console.log("Created device: " + response.data.id);
                  devices[response.data.id] = response.data;
                }
              }
            });
          },
          function(err) {
            // Do Once all are done
            if (err) {
              throw err;
              //console.error("Error Creating all devices: " + err);
              //res.sendStatus(400);
            } else {
              if (config.debug) {
                console.log("Devices: " + JSON.stringify(devices));
              }

              var annotatedDevices = [];
              var deviceIds = Object.keys(devices);
              for (var index = 0; index < deviceIds.length; index++) {
                var aDevice = devices[deviceIds[index]];
                aDevice.readableName = deviceTypes[aDevice.dtid].name;
                aDevice.fullName = deviceTypes[aDevice.dtid].fullName;

                annotatedDevices.push(aDevice);
              }
              res.render('devices.html', { user: req.user, devices: annotatedDevices});
            }
          }
        );
      }
    });
  }
);

// catch 404 and forward to error handler
app.use(function(req, res, next) {
  var err = new Error('Not Found');
  err.status = 404;
  next(err);
});

// error handlers

// development error handler
// will print stacktrace
if (app.get('env') === 'development') {
  app.use(function(err, req, res, next) {
    res.status(err.status || 500);
    res.render('error.html', {
      message: err.message,
      error: err
    });
  });
}

// production error handler
// no stacktraces leaked to user
app.use(function(err, req, res, next) {
  res.status(err.status || 500);
  res.render('error.html', {
    message: err.message,
    error: {}
  });
});


module.exports = app;
