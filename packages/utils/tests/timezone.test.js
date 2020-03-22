const moment = require('moment-timezone')

test("Asia/Shanghai", function(){
    const TIMEZONE = 'Asia/Shanghai'
    let dt = '2020-01-01T22:00:00'
    let m11 = moment.utc(dt)
    let m12 = moment(dt).utcOffset(0, true)
    expect(m11.format('YYYYMMDDHH')).toBe(m12.format('YYYYMMDDHH'))
    let m2 = moment(m11).tz(TIMEZONE)
    let m3 = moment(m11).utcOffset(8)
    console.log('Shanghai m11', m11)
    console.log('Shanghai m12', m12)
    console.log('Shanghai m2', m2)
    console.log('Shanghai m3', m3)
    console.log(moment(new Date()))
    console.log(moment(new Date()).utcOffset(0))
    expect(m2.format('YYYYMMDDHH')).toBe('2020010206')

    for(let i = 0; i < 30; i++){
        let m = moment(m2).add(i, 'day')
        console.log(`${TIMEZONE} ${m} -> ${m.format('YYYYww')} - ISO ${m.format('YYYYWW')}`)
    }
})
test("America/Los_Angeles", function(){
    const TIMEZONE = "America/Los_Angeles"
    let dt = '2020-01-01T22:00:00'
    let m11 = moment.utc(dt)
    let m12 = moment(dt).utcOffset(0, true)
    expect(m11.format('YYYYMMDDHH')).toBe(m12.format('YYYYMMDDHH'))
    let m2 = moment(m11).tz(TIMEZONE)
    let m3 = moment(m11).utcOffset(-8)
    console.log('Los_Angeles m11', m11)
    console.log('Los_Angeles m12', m12)
    console.log('Los_Angeles m2', m2)
    console.log('Los_Angeles m3', m3)
    console.log('Los_Angeles', moment().tz(TIMEZONE), moment().tz(TIMEZONE).format('YYYYMMDDHH'))
    expect(m2.format('YYYYMMDDHH')).toBe('2020010114')


    for(let i = 0; i < 30; i++){
        let m = moment(m2).add(i, 'day')
        console.log(`${TIMEZONE} ${m} -> ${m.format('YYYYww')} - ISO ${m.format('YYYYWW')}`)
    }
})

test("Asia/Shanghai", function(){
    const TIMEZONE = 'Asia/Shanghai'
    let m1 = moment('20200123','YYYYMMDD')
    console.log(m1)
    let m2 = moment('202002','YYYYWW')
    console.log(m2, m2.format('YYYYWW'))
    console.log(moment(m2).startOf('isoWeek'), moment(m2).endOf('isoWeek'))
    m2 = moment('202003','YYYYWW')
    console.log(m2)
    console.log(m2, m2.format('YYYYWW'))
    console.log(moment(m2).startOf('isoWeek'),
        moment(m2).startOf('isoWeek').format('YYYYWW'), 
        moment(m2).endOf('isoWeek'), 
        moment(m2).endOf('isoWeek').format('YYYYWW'))
})