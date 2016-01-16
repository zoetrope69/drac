#! /usr/bin/env node

var chalk = require('chalk');
var drac = require('./drac.js');

var args = process.argv.slice(2);
var command = args[0];

console.log('');

switch (command) {

  case 'download':
    drac.watch();
    break;

  case 'upload':
    var file = args[1];

    if (!file) {
      console.log(chalk.red('No file! 📁'));
      return console.log(chalk.dim('Example: draco upload dad.csv'));
    }

    drac.upload(file, function(err, result, data) {
      if (err) {
        return console.log(err);
      }

      console.log(chalk.green(result));
    });

    break;

  default:
    console.log("Try 'upload' or 'download'");
    break;

}
