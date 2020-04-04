const fs = require('fs')
const zlib = require('zlib')
const path = require('path')
const css = require('css')
const { pipeStreams, WritableBufferStream } = require('@vimesh/utils')

const cssStream = fs.createReadStream(path.join(__dirname, '../tailwind@1.2.0.min.css.gz'))
const unzip = zlib.createGunzip()
let bufferStream = new WritableBufferStream()
//css.stringify(obj, options);
pipeStreams(cssStream, unzip, bufferStream).then(() => {
    let content = bufferStream.toBuffer().toString()
    var obj = css.parse(content);
    //console.log(obj)
    console.log(obj.stylesheet.rules[101], obj.stylesheet.rules[0]);
    // console.log(css.stringify(obj.stylesheet.rules[101]))
    // console.log(css.stringify(obj))
    let ss = {
        type: 'stylesheet',
        stylesheet: {
            rules: [obj.stylesheet.rules[101]]
        }
    }
    console.log(css.stringify(ss))
})
