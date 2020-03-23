const _ = require('lodash')
const { sanitize, sanitizeJson } = require('..')

test('sanitize string', function () {
    let source = '<u:y><b>hello <bogus><i>world</i></bogus></b>'
    expect('<b>hello <i>world</i></b>').toBe(sanitize(source))

    source = '<form> <input type="text" name="q" value="test"> <button id="submit">Submit</button> </form>'
    expect('  Submit ').toBe(sanitize(source))

    source = '<script type="text/javascript"> alert(/xss/); </script>'
    expect('').toBe(sanitize(source))

    source = '<b>hello <i>world</i><script src=foo.js></script></b>'
    expect('<b>hello <i>world</i></b>').toBe(sanitize(source))

    source = '<b>hello <i onclick="takeOverWorld(this)">world</i></b>'
    expect('<b>hello <i>world</i></b>').toBe(sanitize(source))

    source = '<b>hello <i>world<</i></b> & tomorrow the universe'
    expect('<b>hello <i>world&lt;</i></b> & tomorrow the universe').toBe(sanitize(source))

    source = '<b id="foo" / -->hello <i>world<</i></b>'
    expect('<b>hello <i>world&lt;</i></b>').toBe(sanitize(source))

    source = '<b id="a," class="b c/d e">hello <i class="i*j">world<</i></b>'
    expect('<b>hello <i>world&lt;</i></b>').toBe(sanitize(source))

    source = '<b whacky=foo><script src=badness.js></script>bar</b id=foo>'
    expect('<b>bar</b>').toBe(sanitize(source))

    source = '<b title="a<b && c>b">bar</b>'
    expect('<b>bar</b>').toBe(sanitize(source))

    source = 'Foo<b></select>Bar</b></b>Baz</select>'
    expect('Foo<b>Bar</b></b>Baz').toBe(sanitize(source))

    // this is not a possible HTML, ignore it
    source = '</meta http-equiv="refresh" content="1;URL=http://evilgadget.com">'
    expect('</meta http-equiv="refresh" content="1;URL=http://evilgadget.com">').toBe(sanitize(source))

    source = '<input></input>'
    expect('').toBe(sanitize(source))

    source = '<img src=http://foo.com/bar ONLOAD=alert(1)>'
    expect('<img src="http://foo.com/bar">').toBe(sanitize(source))

    source = '<p><a name="foo"/> This is the foo section.</p><p><a name="bar"/> This is the bar section.</p>'
    expect('<p><a /> This is the foo section.</p><p><a /> This is the bar section.</p>').toBe(sanitize(source))

    source = '<html>'
        + '<head>'
        + '<title>Blah</title>'
        + '<p>Foo</p>'
        + '</head>'
        + '<body>'
        + '<p>One</p>'
        + '<p>Two</p>'
        + 'Three'
        + '<p>Four</p>'
        + '</body>'
        + '</html>'
    expect('Blah<p>Foo</p><p>One</p><p>Two</p>Three<p>Four</p>').toBe(sanitize(source))

    source = '<A TITLE="x\0  SCRIPT=javascript:alert(1) ignored=ignored">'
    expect('<a title="x   SCRIPT=javascript:alert(1) ignored=ignored">').toBe(sanitize(source))

})
test('sanitize json', function () {
    let json = {
        a: 'hello',
        b: '"<script type="text/javascript"> alert(/xss/); </script>world/>',
        i1: 123,
        c: {
            d: '<b>hello <i onclick="takeOverWorld(this)">world</i></b>',
            e: [
                1,
                2,
                '<img src=http://foo.com/bar ONLOAD=alert(1)>',
                3
            ]

        },
        d: 'a > 9'
    }
    expect(sanitizeJson(json)).toEqual(
        {
            "a": "hello",
            "b": "\"world/&gt;",
            "i1": 123,
            "c": {
                "d": "<b>hello <i>world</i></b>",
                "e": [1, 2, "<img src=\"http://foo.com/bar\">", 3]
            },
            "d": "a > 9"
        })
})