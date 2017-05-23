# A Node.js Web app sends data to and receives data from ARTIK Cloud

A Node.js sample that connects to fitbit, withings and jawbone cloud connector to retrieve fitness data.


Introduction
-------------

## Setup
* Create an [ARTIK Cloud Developer Application](https://developer.artik.cloud)
* Application should add *permissions* for following *Device Type Ids*:

```json
Withings: dt29673f0481b4401bb73a622353b96150
Fitbit: dt8e71cabde68b4028b106832247cd6d72
Jawbone: dt548080e90be144f080ce28b26be62929
Openweathermap: dt9ad7ecfd34324765a9b12ef98a51b29e
```

* Application should set following *redirect_uri* for this sample:

```
http://localhost:4444/login/artikcloud/callback
```

* Add your client id / client secret to config.json file

```
{
  "address": "0.0.0.0",
  "port" : 4444,
  "debug" : true,
  "sessionSecret" : "not-so-very-secret",
  "oauth": {
    "clientID": "your-client-id",
    "clientSecret": "your-client-secret",
    "callbackURL": "http://localhost:4444/login/artikcloud/callback"
}

```

## Run Sample
%> npm install
%> ./bin/www

Browse to http://localhost:4444

## Screenshot
![Alt text](./screenshots/image1.png "image1")


More about ARTIK Cloud
---------------

If you are not familiar with ARTIK Cloud, we have extensive documentation at https://developer.artik.cloud/documentation

The full ARTIK Cloud API specification can be found at https://developer.artik.cloud/documentation/api-spec.html

Peek into advanced sample applications at https://developer.artik.cloud/documentation/samples/

To create and manage your services and devices on ARTIK Cloud, visit the Developer Dashboard at https://developer.artik.cloud


License and Copyright
---------------------

Licensed under the Apache License. See LICENSE.

Copyright (c) 2016 Samsung Electronics Co., Ltd.
