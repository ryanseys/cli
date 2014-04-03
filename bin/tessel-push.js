#!/usr/bin/env node

var common = require('../src/common')
common.basic();

// Command-line arguments
var argv = require("nomnom")
  .script('tessel-node')
  .option('script', {
    position: 1,
    // required: true,
    full: 'script.js',
    help: 'Run this script on Tessel.',
  })
  .option('args', {
    abbr: 'a',
    list: true,
    help: 'Arguments to pass in as process.argv.'
  })
  .option('quiet', {
    abbr: 'q',
    flag: true,
    help: '[Tessel] Hide tessel deployment messages.'
  })
  .option('messages', {
    abbr: 'm',
    flag: true,
    help: '[Tessel] Forward stdin as child process messages.'
  })
  .option('single', {
    abbr: 's',
    flag: true,
    help: '[Tessel] Push a single script file to Tessel.'
  })

  .parse();

argv.verbose = !argv.quiet;

function usage () {
  console.error(require('nomnom').getUsage());
  process.exit(1);
}

common.controller(function (err, client) {
  client.listen(true, [10, 11, 12, 13, 20, 21, 22])
  client.on('error', function (err) {
    if (err.code == 'ENOENT') {
      console.error('Error: Cannot connect to Tessel locally.')
    } else {
      console.error(err);
    }
  })

  // Forward stdin as messages with "-m" option
  if (argv.messages) {
    process.stdin.resume();
    require('readline').createInterface(process.stdin, {}, null).on('line', function (std) {
      client.send(JSON.stringify(std));
    })
  }

  // Check pushing path.
  if (!argv.script) {
    usage();
  } else {
    var pushpath = argv.script;
  }

  // Command command.
  var updating = false;
  client.on('command', function (command, data) {
    if (command == 'u') {
      verbose && console.error(data.grey)
    } else if (command == 'U') {
      if (updating) {
        // Interrupted by other deploy
        process.exit(0);
      }
      updating = true;
    }
  });

  client.once('script-start', function () {
    // Stop on Ctrl+C.
    process.on('SIGINT', function() {
      client.once('script-stop', function (code) {
        process.exit(code);
      });
      setTimeout(function () {
        // timeout :|
        process.exit(code);
      }, 5000);
      client.stop();
    });

    // Flush existing output, then pipe output to client
    while (null !== (chunk = client.stdout.read())) {
      ;
    }
    client.stdout.pipe(process.stdout);

    client.once('script-stop', function (code) {
      client.end();
      process.exit(code);
    });
  });

  // Forward path and code to tessel cli handling.
  common.pushCode(client, pushpath, ['tessel', pushpath].concat(argv.arguments || []), {}, argv);
})