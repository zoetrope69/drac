var usb = require('usb');

var glob = require('glob');
var fs = require('fs');

var uuid = require('node-uuid');
var crypto = require('crypto');

var amoeba = require('amoeba');
var base32hex = amoeba.base32hex;
var except = amoeba.except;

var Converter = require('csvtojson').Converter;
var converter = new Converter({});

var chalk = require('chalk');

// from my device, not sure if this for every one?
var bloodGlucoseMachine = {
  vendorId: 5946,
  productId: 8600
};

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

function convertAccuChekDateToISO(date, time){
  date = date.split('.');

  var year = date[2];
  var month = date[1];
  var day = date[0];

  return year + '-' + month + '-' + day + 'T' + time + ':000Z'
}

function readData() {

  console.log(chalk.blue('  📲  Reading data...'));

  var path = '/media/zac/ACCU-CHEK/ACCU-CHEK Mobile/Reports/';

  glob(path + '*.csv', function (err, files) {
    if (err) {
      console.log(err);
    }

    if (!files.length) {
      console.log(chalk.red('  📁  No file!'));
    }

    var file = files[0];

    fs.readFile(file, 'utf8', function (err, data) {
      if (err) {
        return console.log(err);
      }

      console.log(chalk.blue('  📈  Processing data...'));

      // remove intial whitespace, split by linebreak
      data = data.trim().split('\n');

      // we want the second row from the file, this has the device data
      // everything in this file is semi-colon seperated, this row has three values
      var deviceData = data[1].split(';').slice(0, 3);

      var deviceSerialNumber = deviceData[0];
      var deviceDateDMY = deviceData[1];
      var deviceDateHM = deviceData[2];

      var deviceTime = convertAccuChekDateToISO(deviceDateDMY, deviceDateHM);
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

        var time = convertAccuChekDateToISO(readingDate, readingTime);
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

        console.log(chalk.green('  💾  Saved to "' + outputPath + '"'));
      });

    });

  })

}

function checkIfBloodGlucoseMachineMounted() {

  var device = usb.findByIds(bloodGlucoseMachine.vendorId, bloodGlucoseMachine.productId);

  if (typeof device !== 'undefined') {
    console.log(chalk.yellow('   📱 BGM connected!'));

    // wait for device to mount
    readData();
  }

}

function isBloodGlucoseMachine(device){
  return device.vendorId === bloodGlucoseMachine.vendorId
      && device.productId === bloodGlucoseMachine.productId;
}

checkIfBloodGlucoseMachineMounted();

usb.on('attach', function(device) {

  if (isBloodGlucoseMachine) {
    console.log(chalk.yellow('   📱 BGM connected!'));

    // wait some secs for it to mount
    // probably a better way to do this
    setTimeout(readData, 5000);
  }

});

usb.on('detach', function(device) {

  if (isBloodGlucoseMachine) {
    console.log(chalk.yellow('  📴  BGM disconnected!'));
  }

});
