var usb = require('usb');

var glob = require('glob');
var fs = require('fs');

var uuid = require('node-uuid');
var crypto = require('crypto');

var amoeba = require('amoeba');
var base32hex = amoeba.base32hex;
var except = amoeba.except;

var chalk = require('chalk');

// from my device, not sure if this for every one?
var bloodGlucoseMachine = {
  vendorId: 5946,
  productId: 8600
};

function trimQuotes(string) {
  return string.substring(1, string.length - 1);
}

// from https://github.com/tidepool-org/jellyfish/blob/7721a9f8650d8cb26bc4305ae290ed3589a86769/lib/misc.js
function generateId(fields) {
  var hasher = crypto.createHash('sha1');

  for (var i = 0; i < fields.length; ++i) {
    var val = fields[i];
    if (val == null) {
      throw except.IAE('null value in fields[%s]', fields);
    }
    hasher.update(String(val));
    hasher.update('_');
  }
  // adding an additional string to the hash data for BtUTC
  // to ensure different IDs generated when uploading data
  // that has been uploaded before
  hasher.update(String('bootstrap'));
  hasher.update('_');

  return base32hex.encodeBuffer(hasher.digest(), { paddingChar: '-' });
};

function convertAccuChekMobileDateToISO(date, time){
  date = date.split('.');

  var year = date[2];
  var month = date[1];
  var day = date[0];

  return year + '-' + month + '-' + day + 'T' + time + ':000Z';
}

function convertAccuChekAvivaExpertDateToISO(date, time){
  date = date.split('/');

  var year = date[2];
  var month = date[0];
  var day = date[1];

  return year + '-' + month + '-' + day + 'T' + time + '0Z';
}

module.exports = {

  info: function () {

    console.log('\033[2J');

    console.log(chalk.dim("             _..._        "));
    console.log(chalk.dim("           .'     '.      "));
    console.log(chalk.dim("          ; __   __ ;     "));
    console.log(chalk.dim("          |/  \\ /  \\|     "));
    console.log(chalk.dim("        |\\| -- ' -- |/|   "));
    console.log(chalk.dim("        |(| \\o| |o/ |)|   "));
    console.log(chalk.dim("        _\\|     >   |/_   "));
    console.log(chalk.dim("     .-'  | ,.___., |  '-."));
    console.log(chalk.dim("     \\    ;  V'-'V  ;    /"));
    console.log(chalk.dim("      `\\   \\       /   /` "));
    console.log(chalk.dim("        `\\  '-...-'  /`   "));
    console.log(chalk.dim("          `\\  / \\  /`     "));
    console.log(chalk.dim("        💉   `\\\\_//`  🍬   "));

    console.log('\n');

    console.log(chalk.red('  ___     ___     ____    _____'));
    console.log(chalk.red(' ||   \\  ||   \\  ||   |  ||    '));
    console.log(chalk.red(' ||   |  ||   |  ||   |  ||    '));
    console.log(chalk.red(' ||   |  ||--.   ||---|  ||    '));
    console.log(chalk.red(' ||__/   ||   \\  ||   |   \\\\___'));

    console.log('\n');
    console.log(chalk.dim('  Give me your blood you fuck.'))
    console.log('\n');

  },

  // mg/dl = 18 × mmol/l
  mgdl2mmoll: function (mgdl) {
    mmoll = mgdl / 18;
    return mmoll.toFixed(2);
  },

  // mmol/l = mg/dl / 18
  mmoll2mgdl: function (mmoll) {
    mgdl = 18 * mmoll;
    return mgdl.toFixed(2);
  },

  checkIfBloodGlucoseMachineMounted: function() {

    var device = usb.findByIds(bloodGlucoseMachine.vendorId, bloodGlucoseMachine.productId);

    if (typeof device !== 'undefined') {
      console.log(chalk.yellow('BGM connected! 📱'));

      // wait for device to mount
      this.readAccuChekMobile();
    }

  },

  isBloodGlucoseMachine: function (device) {
    return device.vendorId === bloodGlucoseMachine.vendorId
        && device.productId === bloodGlucoseMachine.productId;
  },

  upload: function (file) {

    var self = this;

    this.detectDevice(file, function(err, result, data){
      if (err) {
        return console.log(err);
      }

      self.processFile(result, data, function(err, result){
        if (err) {
          return console.log(err);
        }

        console.log(chalk.green(result));
      });
    });

  },

  watch: function () {

    var self = this;

    console.log(chalk.blue('Watching for Accu-Chek Mobile... 📲'));

    self.checkIfBloodGlucoseMachineMounted();

    usb.on('attach', function(device) {

      if (self.isBloodGlucoseMachine) {
        console.log(chalk.yellow('BGM connected! 📱'));

        // wait some secs for it to mount
        // probably a better way to do this
        setTimeout(self.readAccuChekMobile, 5000);
      }

    });

    usb.on('detach', function(device) {

      if (self.isBloodGlucoseMachine) {
        console.log(chalk.yellow('BGM disconnected! 📴'));
      }

    });

  },

  readAccuChekMobile: function() {

    var self = this;

    console.log(chalk.blue('Reading data... 📲'));

    var path = '/media/zac/ACCU-CHEK/ACCU-CHEK Mobile/Reports/';

    glob(path + '*.csv', function (err, files) {
      if (err) {
        console.log(err);
      }

      if (!files.length) {
        console.log(chalk.red('No file! 📁'));
      }

      var file = files[0];

      self.upload(file, function(err, data) {
        if (err) {
          return console.log(err);
        }

        console.log(data);
      });

    });
  },

  detectDevice: function (file, callback) {
    fs.readFile(file, 'utf8', function (err, data) {
      if (err) {
        callback('Error:' + err, null);
      }

      // some unique strings that should let us work out which device the data came from
      var testStrings = {
        accuChekAvivaExpert: '"Insulin1 (units)";"Insulin2 (units)";"Insulin3 (units)"',
        accuChekMobile: 'Serial number;Download date;Download time;;;;;;;'
      };

      // test data for each string
      for (var device in testStrings) {
        // don't loop through meta info for obj
        if (!testStrings.hasOwnProperty(device)) {
          continue;
        }

        var testString = testStrings[device];

        if (data.includes(testString)) {
          return callback(null, device, data);
        }

      }

    });
  },

  processFile: function(result, data, callback) {
    if (result === 'accuChekMobile') {
      this.processFileAccuChekMobile(result, data, callback);
    }
    if (result === 'accuChekAvivaExpert') {
      this.processFileAccuChekAvivaExpert(result, data, callback);
    }
  },

  processFileAccuChekAvivaExpert: function(result, data, callback) {

    var self = this;

    console.log(chalk.blue('Processing data... 📈'));

    // remove intial whitespace, split by linebreak
    data = data.trim().split('\n');

    // we want the first row from the file, this has the device data
    // everything in this file is semi-colon seperated, this row has three values
    var dateTime = trimQuotes(data[0].split(';')[1]).split(' ');

    var deviceSerialNumber = '66110229488'; // hardcoded for the moment
    var deviceDateDMY = dateTime[0];
    var deviceDateHM = dateTime[1];

    var deviceTime = convertAccuChekAvivaExpertDateToISO(deviceDateDMY, deviceDateHM);
    var deviceId = 'AccuChekAvivaExpert' + deviceSerialNumber;

    /* remove first 8 unneeded rows:

      "C:\Path\To\File\Download.CSV";"01/01/1990 10:20:30";"";"";"";"";""; ...
      "";"";"";"";"";"";"";"";"";"";"";"";"";"";"";"";"";"";"";"";"";"";""; ...
      "";"";"";"";"";"";"";"";"";"";"";"";"";"";"";"";"";"";"";"";"";"";""; ...
      "Snow";"Mr";"John";"";"";"";"";"";"";"";"";"";"";"";"";"";"";"";"";""; ...
      "01/01/1990 00:00:00";"";"";"";"";"";"";"";"";"";"";"";"";"";"";"";""; ...
      "";"";"";"";"";"";"";"";"";"";"";"";"";"";"";"";"";"";"";"";"";"";""; ...
      "";"";"";"";"";"";"";"";"";"";"";"";"";"";"";"";"";"";"";"";"";"";""; ...
      "Date";"Time";"bG (mg/dL)";"Insulin1 (units)";"Insulin2 (units)";"Insulin3 (units)";"Insulin Pump (units)";"bG Control";"bG Lab (mg/dL)";"Carbohydrates (g)";"Exercise Duration (Minutes)";"Exercise Intensity";"System-Defined Events";"User-Defined Events";"Flags";"Medication Name";"Medication Dosage";"Start Date";"End Date";"Comments";"Description";"Administered By";"Education Comments";"Visit Note Created Date";"Visit Note";"Visit Note Originated By";"Visit Note Attachment URLs";"Region";"Severity";"Symptoms 1";"Symptoms 2";"Symptoms 3";"Findings";"Comments";"Albumin (mg/L)";"Cholesterol (mg/dL)";"Chol HDL (mg/dL)";"Chol LDL (mg/dL)";"Chol Ratio";"Creatinine (micromols/L)";"Fructosamine (micromols/L)";"HbA1c (Percent)";"HbA1 (Percent)";"Ketones";"Micral";"Proteinuria (mg/dL)";"Temperature (Degrees C)";"Tryglycerides (mg/dL)";"Weight (kg)";"Height (cm)";"Blood Pressure (Systolic) (kPa)";"Blood Pressure (Diastolic) (kPa)";"Pulse (BPM)";"Insulin Rate (units/Hour)";"Insulin TDD (units)";
    */
    var readings = data.slice(8);

    var output = readings.map(function(reading) {
      // data is semi-colon seperated so split by this and then remove extraneous columns
      reading = reading.split(';').slice(0, 3);

      var readingDate = trimQuotes(reading[0]);
      var readingTime = trimQuotes(reading[1]);

      var time = convertAccuChekAvivaExpertDateToISO(readingDate, readingTime);
      var value = trimQuotes(reading[2]);

      // if there's no blood value don't include
      if (value.length > 0) {

        // convert to mmoll
        value = self.mgdl2mmoll(value);

        var type = 'smbg';
        var subType = 'manual';
        var units = 'mmol/L';

        var guid = uuid.v4();

        var id = generateId([type, subType, deviceId, time]);

        return {
          id: id,
          guid: guid,
          type: type,
          deviceId: deviceId,
          deviceTime: deviceTime,
          subType: subType,
          units: units,
          time: time,
          value: value
        };

      }

    });

    output = output.filter(function(item){ return typeof item !== 'undefined'; });

    var createdTime = new Date().toISOString();

    var outputPath = __dirname + '/data/' + deviceId + '_' + createdTime + '.json';

    fs.writeFile(outputPath, JSON.stringify(output, null, 3), function(err) {
      if(err) {
        return console.log(err);
      }

      callback(null, 'Saved to "' + outputPath + '" 💾', JSON.stringify(output, null, 3));
    });

  },

  processFileAccuChekMobile: function(result, data, callback) {

    console.log(chalk.blue('Processing data... 📈'));

    // remove intial whitespace, split by linebreak
    data = data.trim().split('\n');

    // we want the second row from the file, this has the device data
    // everything in this file is semi-colon seperated, this row has three values
    var deviceData = data[1].split(';').slice(0, 3);

    var deviceSerialNumber = deviceData[0];
    var deviceDateDMY = deviceData[1];
    var deviceDateHM = deviceData[2];

    var deviceTime = convertAccuChekMobileDateToISO(deviceDateDMY, deviceDateHM);
    var deviceId = 'AccuChekMobile' + deviceSerialNumber;

    /* remove first three unneeded rows:

      Serial number;Download date;Download time;;;;;;;
      U100241440;08.12.2015;17:04;;;;;;;
      Date;Time;Result;Unit;Temperature warning;Out of target range;Other;Before meal;After meal;Control test
    */
    var readings = data.slice(3);

    var output = readings.map(function(reading) {
      // data is semi-colon seperated so split by this and then remove extraneous columns
      reading = reading.split(';').slice(0, 3);

      var readingDate = reading[0];
      var readingTime = reading[1];

      var time = convertAccuChekMobileDateToISO(readingDate, readingTime);
      var value = reading[2];

      var type = 'smbg';
      var subType = 'manual';
      var units = 'mmol/L';

      var guid = uuid.v4();

      var id = generateId([type, subType, deviceId, time]);

      return {
        id: id,
        guid: guid,
        type: type,
        deviceId: deviceId,
        deviceTime: deviceTime,
        subType: subType,
        units: units,
        time: time,
        value: value
      };

    });

    var createdTime = new Date().toISOString();

    var outputPath = __dirname + '/data/' + deviceId + '_' + createdTime + '.json';

    fs.writeFile(outputPath, JSON.stringify(output, null, 3), function(err) {
      if(err) {
        return console.log(err);
      }

      callback(null, 'Saved to "' + outputPath + '" 💾', JSON.stringify(output, null, 3));
    });

  }

}
