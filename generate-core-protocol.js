'use strict'

var _ = require('lodash');
var fs = require('fs');

var runtimes = [
  {
    name: 'Chrome',
    protocol: require('./protocols/blink/browser_protocol.json'),
  },
  {
    name: 'Safari iOS 9.3',
    protocol: require('./protocols/webkit/iOS-9.3.json'),
  },
  {
    name: 'Safari iOS 9.0',
    protocol: require('./protocols/webkit/iOS-9.0.json'),
  }, 
  {
    name: 'Safari iOS 8.0',
    protocol: require('./protocols/webkit/iOS-8.0.json'),
  },                               
  {
    name: 'Safari iOS 7.0',
    protocol: require('./protocols/webkit/iOS-7.0.json'),
  },
]

var commonDomains = []
var domains = getDomains()

domains.forEach(function(domain) {
    let commands = generateCompatibilityPairs(domain, 'commands', 'name').filter(item => item.hasParity === true)
    let events = generateCompatibilityPairs(domain, 'events', 'name').filter(item => item.hasParity === true)
    let types = generateCompatibilityPairs(domain, 'types', 'id').filter(item => item.hasParity === true)

    if(commands.length || events.length || types.length) {


      var dObject = {
        domain: domain.name,
        hidden: false,
        commands: commands.map(item => item.flat.object),
        events: events.map(item => item.flat.object),
        types: events.map(item => item.flat.object)
      }

      commonDomains.push(dObject)
    }
})


var commonProtocol = {
    version: { 
      major: 1, 
      minor: 1
    },
    domains: commonDomains
}


fs.writeFile('core.json', JSON.stringify(commonProtocol, null, 2), function(err) {
    if(err) {
      console.log(err);
    } else {
      console.log('Core Protocol JSON file generated');
    }
}); 


function generateCompatibilityPairs(domain, type, propertyKey) {
  var runtimes = domain.runtimes  
  var runtimesCount = runtimes.length
  
  var commands = new Map()
  
  runtimes.forEach(function(runtime, index) {     
    if(runtime.protocol && runtime.protocol[type]) {
      runtime.protocol[type]
        .sort(function(a, b) {
          var x = a[propertyKey]; var y = b[propertyKey]
          return ((x < y) ? -1 : ((x > y) ? 1 : 0))
        })
        .forEach(function(command) {
          var cItem = {
            runtime: runtime.name,
            command: command
          }
          
          if(commands.has(command[propertyKey])) {
            var entry = commands.get(command[propertyKey])
            entry.push(cItem)
          } else {
            commands.set(command[propertyKey], [cItem])
          }
        }) 
      }   
  })
  
  var commandPairs = []
  commands.forEach(function(command, key) {
    var pair = _.fill(Array(runtimesCount), null)
    
    command.forEach(function(item) {
      var runtime = _.find(runtimes, r => r.name === item.runtime)
      var runtimeIndex = runtimes.indexOf(runtime)
      pair[runtimeIndex] = {
        name: item.command[propertyKey],
        object: item.command
      }
    })
    
    var namePairs = pair.map(i => i ? i[propertyKey] : null)
    var hasParity = namePairs.every(i => i === namePairs[0])
    
    commandPairs.push({
      hasParity: hasParity,
      pair: pair,
      flat: _.compact(pair)[0]
    })
  })
  
  return commandPairs
    
} 

function getDomains() {
  // Create unique list of domains
  var domains = []
  runtimes.forEach(function(runtime) {
    var rDomains = runtime.protocol.domains.map(d => d.domain)
    domains = domains.concat(rDomains)
  })  
  domains = _.uniq(domains).sort()

  // Return collection of domains mapped to runtime protocol section
  return domains.sort().map(function(domainName) {
    return {
      name: domainName,
      runtimes: runtimes.map(function(runtime) {
        return {
          name: runtime.name,
          protocol: getDomainForRuntime(runtime.protocol, domainName)
        }
      })
    
    } 
  })
}

function getDomainForRuntime(protocol, name) {
  return _.find(protocol.domains, item => item.domain === name)
}
