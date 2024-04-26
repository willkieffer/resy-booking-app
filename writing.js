const fs = require('fs')

fs.appendFile('newfile.txt', '\nHello World!', (err) => {
  if (err) throw err
  console.log('File written to successfully!')
})
