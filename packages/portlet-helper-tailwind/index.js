const _ = require('lodash')
const setupVimeshStyle = require('@vimesh/style')

function tailwindUse(usedClasses, options) {
    if (!options.data.root._vs) options.data.root._vs = setupVimeshStyle()
    options.data.root._vs.add(usedClasses)
}

function tailwindApply(usedClasses, options) {
    if (!options.data.root._vs) options.data.root._vs = setupVimeshStyle()
    return usedClasses && usedClasses.split(' ').map(cls => options.data.root._vs._.resolveClass(cls)).join('')
}

const TAILWIND_PLACEHOLDER = '/* TAILWINDCSS AUTO INJECTION PLACEHOLDER */'
function injectTailwindStyles(params, context, html) {
    let _vs = context._vs || setupVimeshStyle()
    _vs.add(_vs.extract(html))
    return [
        '/* --- Auto injected from Vimesh Style --- */',
        _vs.styles,
        '/* ------------------------------------- */'
    ].join('\n')
}
function tailwindBlock(options) {
    options.data.root._postProcessors.push({
        order: 10000,
        placeholder: TAILWIND_PLACEHOLDER,
        processor: injectTailwindStyles
    })
    return ['<style>', TAILWIND_PLACEHOLDER, '</style>'].join('\n')
}

module.exports = (portlet) => {
    portlet.registerHbsHelpers({
        tailwindUse,
        twUse: tailwindUse,
        tailwindApply,
        twApply: tailwindApply,
        tailwindBlock,
        twBlock: tailwindBlock
    })
}