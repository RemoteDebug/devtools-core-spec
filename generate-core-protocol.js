'use strict'

var _ = require('lodash')
var fs = require('fs')
var request = require('request-promise')

var fetchChromeProtocol = () => {

  return new Promise((resolve, reject) => {
    var protocol = {
      version: { "major": "1", "minor": "2" },
      domains: []
    }

    var urls = [
      'https://chromium.googlesource.com/chromium/src/+/master/third_party/WebKit/Source/core/inspector/browser_protocol.json?format=TEXT',
      'https://chromium.googlesource.com/v8/v8/+/master/src/inspector/js_protocol.json?format=TEXT'
    ]

    var fetchedProtocols = urls.map(url => {
      return request(url).then(body => {
        return JSON.parse(Buffer.from(body, 'base64').toString('utf8'))
      })
    })

    Promise.all(fetchedProtocols).then(protocols => {
      var mergedDomains = []
      protocols.forEach(protocol => {
        mergedDomains.push(...protocol.domains)
      })

      protocol.domains = mergedDomains
      resolve(protocol)
    })
  })
}

var fetchWebkitProtocol = () => {
  return new Promise((resolve, reject) => {
    var url = 'https://raw.githubusercontent.com/WebKit/webkit/master/Source/WebInspectorUI/Versions/Inspector-iOS-10.0.json'
    
    request(url).then(body => {
      resolve(JSON.parse(body))
    }).catch(reject)
  })
}

Promise.all([fetchWebkitProtocol(), fetchChromeProtocol()]).then(protocols => {

  var runtimes = {
    'chrome': protocols[1],
    'webkit': protocols[0],
  }

  var commonDomains = getCommonDomains(runtimes)
  
  var commonProtocol = {
    version: {
      major: 1,
      minor: 0
    },
    domains: commonDomains
  }

  fs.writeFile('protocol.json', JSON.stringify(commonProtocol, null, 2), function (err) {
    if (err) {
      console.log(err)
    } else {
      console.log('Core Protocol JSON file generated')
    }
  })

}).catch(err => {
  console.log('err', err)
})

function isNotExperimental(o) {
  if(o.experimental === undefined || o.experimental === null || o.experimental === false) { 
    return true
  } else {
    return false
  }
}

function getCommonObjects(runtimes, domainName, typeName, propertyName) {
  var pool = []
  var commonList = new Map()
  var seenList = new Map()

  Object.keys(runtimes).forEach((runtimeName) => {
    var protocol = runtimes[runtimeName]
    var domain = _.find(protocol.domains, { domain: domainName })

    if(domain && domain[typeName] && isNotExperimental(domain)) {
      pool.push(domain[typeName])
    } 
  })

  pool.forEach( p => {
    p.forEach(i => {
      if(isNotExperimental(i[propertyName])) {
        if(seenList.has(i[propertyName])) { // Only add common stuff
          commonList.set(i[propertyName], i)
        } else {
          seenList.set(i[propertyName], i)
        }
      }
    })
  })
  return Array.from(commonList.values()) 
}

function getCommonDomains(runtimes) {
  var domains = getDomains(runtimes)
  var commonDomains = []

  domains.forEach((domainObject) => {
    let commands = getCommonObjects(runtimes, domainObject.domain, 'commands', 'name')
    let events = getCommonObjects(runtimes, domainObject.domain, 'events', 'name')
    let types = getCommonObjects(runtimes, domainObject.domain, 'types', 'id')
  
    if (commands.length || events.length || types.length) {
      commonDomains.push({
        domain: domainObject.name,
        commands: commands,
        events: events,
        types: types
      })
    }
  })

  return commonDomains
}

function getDomains (runtimes) {
  var domains = []
  Object.keys(runtimes).forEach((runtimeName) => {
    var protocol = runtimes[runtimeName]
    domains.push(...protocol.domains)
  })
  return domains.sort()
}
