/*
 |--------------------------------------------------------------------------
 | App Setup
 |--------------------------------------------------------------------------
 |
 | Untuk menghandle models, libraries, helper, node modules, dan lain-lain
 |
 */
    //Models
    /*
|--------------------------------------------------------------------------
| Variable
|--------------------------------------------------------------------------
*/
    
    // Models
    const Point = require( _directory_base + '/app/v1.0/models/Point.js' );
    const History = require( _directory_base + '/app/v1.0/models/History.js' );
    const Holiday = require( _directory_base + '/app/v1.0/models/Holiday.js' );
    const InspectionH = require( _directory_base + '/app/v1.0/models/InspectionH.js' );
    const EBCCValidationHeader = require( _directory_base + '/app/v1.0/models/EBCCValidationHeader.js' );
	const Block = require( _directory_base + '/app/v1.0/models/Block.js' );
    const ViewUserAuth = require( _directory_base + '/app/v1.0/models/ViewUserAuth.js' );
    
	// Node Module
    const async = require('async');
    const moment = require( 'moment-timezone' );
    const dateformat = require('dateformat');
    const axios = require('axios');
	// const { v4: uuidv4 } = require('uuid');
	// Libraries
	// const HelperLib = require( _directory_base + '/app/v2.0/Http/Libraries/HelperLib.js' );

/*
|--------------------------------------------------------------------------
| Kernel
|--------------------------------------------------------------------------
|
| In the past, you may have generated a Cron entry for each task you needed
| to schedule on your server. However, this can quickly become a pain,
| because your task schedule is no longer in source control and you must
| SSH into your server to add additional Cron entries.
|
*/
    class Cron {


        /*
        |--------------------------------------------------------------------------
        | Hitung total point bulanan setiap aslap
        |--------------------------------------------------------------------------
        | 
        |
        */
        async monthlyPoint(req, res) {
            let now = moment(new Date()).tz('Asia/Jakarta');
            let endOfMonth = new Date(now.year(), now.month() + 1, 0);
            let endOfMonthNumber = parseInt(dateformat(endOfMonth, 'yyyymmdd'))
            let endOfMonthNumberFull = parseInt(dateformat(endOfMonth, 'yyyymmddHHMMss'))
            let endOfMonthFormatted = dateformat(endOfMonth, 'mmmm yyyy');
            async.auto({
                getAllAslapPoint: function(callback) {
                    Point.aggregate([
                        {
                            $group: {
                                _id: {
                                    USER_AUTH_CODE: "$USER_AUTH_CODE",
                                    MONTH: "$MONTH"
                                }, 
                                POINT: { $sum: "$POINT" }
                            }
                        }, {
                            $lookup: {
                                from: "VIEW_USER_AUTH",
                                foreignField: "USER_AUTH_CODE",
                                localField: "_id.USER_AUTH_CODE",
                                as: "viewUser"
                            }
                        }, {
                           $unwind: "$viewUser" 
                        }, {
                            $project: {
                                _id: 0,
                                USER_AUTH_CODE: "$_id.USER_AUTH_CODE",
                                FULLNAME: {$ifNull: ["$viewUser.HRIS_FULLNAME", "$viewUser.PJS_FULLNAME"]},
                                MONTH: "$_id.MONTH",
                                POINT: "$POINT"
                            }
                        }, {
                            $match: {
                                MONTH: endOfMonthNumber
                            }
                        }
                    ])
                    .then(data => {
                        callback(null, data);
                    })
                    .catch(err => {
                        callback(err, null);
                    })
                }, 
                sendToNotifications: ['getAllAslapPoint', function(results, callback) {
                    let aslapPoint = results.getAllAslapPoint;
                    async.each(aslapPoint, function(aslap, callbackEach){
                        let body = {
                            FINDING_CODE: '-',
                            CATEGORY: 'TOTAL POINT',
                            NOTIFICATION_TO: aslap.USER_AUTH_CODE,
                            MESSAGE: `Hai ${aslap.FULLNAME}, selama bulan ${endOfMonthFormatted}, kamu telah mendapatkan point dengan total sebesar ${aslap.POINT} points.`,
                            INSERT_TIME: endOfMonthNumberFull
                        }
                        let findingUrl = config.app.url[config.app.env].microservice_finding + '/api/v2.1/notification';
                        // console.log(body);
                        // console.log(findingUrl);
                        axios.defaults.headers.common['Authorization'] = req.headers.authorization;
                        axios.post(
                            findingUrl, 
                            body)
                          .then(function (response) {
                            console.log(response.data);
                            callbackEach();
                          })
                          .catch(function (error) {
                            console.log(error);
                            callbackEach(error, null);
                          });
                    }, function(err) {
                        if(err) {
                            callback(err, null);
                            return;
                        } else {
                            callback(null, aslapPoint)
                        }
                    })
                }]
            }, function(err, results) {
                // console.log(results);
                res.send({
                    status: true,
                    message: 'success',
                    data: { point: results.sendToNotifications }
                })
            })
        }
        /*
        |--------------------------------------------------------------------------
        | Hitung target daily inspection setiap aslap
        |--------------------------------------------------------------------------
        | 
        |
        */
        async checkDailyTransaction(req, res) {
            let now = moment(new Date()).tz('Asia/Jakarta');
            let dayMin2 = new Date(now.year(), now.month(), now.date() - 2);
            let dayMin2Number = dateformat(dayMin2, 'yyyymmdd');
            let endOfMonth = new Date(now.year(), now.month() + 1, 0);
            let endOfMonthNumber = parseInt(dateformat(endOfMonth, 'yyyymmdd'))
            async.auto({
                getAllAslap: function(callback) {
                    ViewUserAuth.aggregate([
                        { 
                            $match:{
                                $and: [
                                    {
                                        USER_ROLE: 'ASISTEN_LAPANGAN',
                                        $or : [
                                            { REF_ROLE : 'BA_CODE' }, 
                                            { REF_ROLE : 'AFD_CODE' } 
                                        ]
                                    }
                                ]
                            }
                        }
                    ])
                    .then(data => {
                        callback(null, data)
                    })
                    .catch(err => {
                        console.log(err);
                        callback(err);
                        return;
                    })
                },
                checkIsHoliday: ['getAllAslap', function(results, callback) {
                    let aslap = results.getAllAslap;
                    async.each(aslap, function(a, callbackEach) {
                        let werks = a.LOCATION_CODE.substring(0, 4)
                        Holiday.findOne({
                            $or: [
                                {
                                    HOLIDAY_DATE: dayMin2Number,
                                    WERKS: werks
                                }, {
                                    HOLIDAY_DATE: dayMin2Number,
                                    WERKS: '-'
                                }
                            ]
                        })
                        .then(data => {
                            //jika hari ini libur nasional, libur werks atau hari minggu maka diskip
                            if(data || dayMin2.getDay() == 0) { 
                                aslap = aslap.filter(as => as.USER_AUTH_CODE != a.USER_AUTH_CODE);
                            }
                            callbackEach();
                        })
                        .catch(err => {
                            console.log(err);
                            callbackEach(err);
                        })
                    }, function(err) {
                        if(err) {
                            callback(err, null);
                            return;
                        } else {
                            callback(null, aslap)
                        }
                    })
                }],
                countDailyInspection: ['checkIsHoliday', function(results, callback) {
                    let aslap = results.checkIsHoliday;
                    let aslapDailyInspection = [];
                    async.each(aslap, function(a, callbackEach) {
                        InspectionH.find({ 
                            INSERT_USER: a.USER_AUTH_CODE, 
                            INSERT_TIME: {
                                $gte: parseInt(dayMin2Number + '000000'),
                                $lte: parseInt(dayMin2Number + '235959')
                            }
                        }).count()
                        .then(data => {
                            let inspection = {};
                            inspection.USER_AUTH_CODE = a.USER_AUTH_CODE;
                            inspection.TOTAL_INSPEKSI = data;
                            inspection.WERKS = a.LOCATION_CODE.substring(0, 4);
                            aslapDailyInspection.push(inspection);
                            callbackEach();
                        })
                        .catch(err => {
                            console.log(err);
                            callbackEach(err);
                        })
                    }, function(err) {
                        if(err) {
                            callback(err, null);
                            return;
                        } else {
                            callback(null, aslapDailyInspection)
                        }
                    })
                }],
                countDailySampling: ['countDailyInspection', function(results, callback) {
                    let aslapTransaction = results.countDailyInspection;
                    async.each(aslapTransaction, function(transaction, callbackEach) {
                        EBCCValidationHeader.find({ 
                            INSERT_USER: transaction.USER_AUTH_CODE, 
                            INSERT_TIME: {
                                $gte: parseInt(dayMin2Number + '000000'),
                                $lte: parseInt(dayMin2Number + '235959')
                            }
                        }).count()
                        .then(data => {
                            transaction.TOTAL_SAMPLING = data;
                            callbackEach();
                        })
                        .catch(err => {
                            console.log(err);
                            callbackEach(err);
                        })
                    }, function(err) {
                        if(err) {
                            callback(err, null);
                            return;
                        } else {
                            callback(null, aslapTransaction)
                        }
                    })
                }],
                countAslapPoint: ['countDailySampling', function(results, callback) {
                    let aslapTransaction = results.countDailySampling;
                    async.each(aslapTransaction, function(transaction, callbackEach) {
                        transaction.POINT = 0;
                        if(transaction.TOTAL_INSPEKSI < 2) {
                            transaction.POINT -= 10;
                        }
                        if(transaction.TOTAL_SAMPLING < 5) {
                            transaction.POINT -= 10; 
                        }
                        callbackEach();
                    }, function(err) {
                        if(err) {
                            callback(err, null);
                            return;
                        } else {
                            callback(null, aslapTransaction)
                        }
                    })
                }],
                updateDBPoint: ['countAslapPoint', function(results, callback) {
                    let aslapPoint = results.countAslapPoint;
                    async.each(aslapPoint, function(aslap, callbackEach) {
                        if(aslap.POINT != 0) {
                            if(aslap.TOTAL_INSPEKSI < 2) {
                                let history = new History({
                                    USER_AUTH_CODE: aslap.USER_AUTH_CODE,
                                    POINT: -10,
                                    BA_CODE: aslap.WERKS,
                                    PERIOD: endOfMonthNumber,
                                    DATE: dayMin2Number,
                                    TYPE: 'INSPEKSI',
                                    REMARKS: '2 target inspeksi tidak terpenuhi',
                                    REFERENCE: ``
                                });
                                history.save()
                                .then(() => {
                                    console.log('sukses save history', aslap.USER_AUTH_CODE);
                                })
                                .catch(err => {
                                    console.log(err);
                                    callbackEach2(err);
                                    return;
                                })
                            }
                            if(aslap.TOTAL_SAMPLING < 5) {
                                let history = new History({
                                    USER_AUTH_CODE: aslap.USER_AUTH_CODE,
                                    POINT: -10,
                                    BA_CODE: aslap.WERKS,
                                    PERIOD: endOfMonthNumber,
                                    DATE: dayMin2Number,
                                    TYPE: 'SAMPLING_EBCC',
                                    REMARKS: '5 target sampling tidak terpenuhi',
                                    REFERENCE: ``
                                });
                                history.save()
                                .then(() => {
                                    console.log('sukses save history', aslap.USER_AUTH_CODE);
                                })
                                .catch(err => {
                                    console.log(err);
                                    callbackEach2(err);
                                    return;
                                })
                            }
                            let set = new Point({
                                USER_AUTH_CODE: aslap.USER_AUTH_CODE, 
                                LOCATION_CODE: aslap.WERKS,
                                MONTH: endOfMonthNumber,
                                POINT: aslap.POINT,
                                LAST_INSPECTION_DATE: 0
                            });
                            set.save()
                            .then(data => {
                                console.log('berhasil save', aslap.USER_AUTH_CODE);
                            })
                            .catch(err => {
                                Point.updateOne({
                                    USER_AUTH_CODE: aslap.USER_AUTH_CODE,
                                    LOCATION_CODE: aslap.WERKS,
                                    MONTH: endOfMonthNumber,
                                }, {
                                    $inc: {
                                        POINT: aslap.POINT
                                    }
                                })
                                .then( () => {
                                    console.log("sukses update", aslap.USER_AUTH_CODE)
                                })
                                .catch(err => {
                                    console.log(err);
                                });
                            });
                        }
                        callbackEach();
                    }, function(err) {
                        if(err) {
                            callback(err, null);
                            return;
                        } else {
                            callback(null, aslapPoint)
                        }
                    })
                }]
            }, function(err, results) {
                // console.log(results);
                res.send({
                    status: true,
                    message: 'success',
                    data: { sampling: results.countDailySampling }
                })
            })
        }
        /*
        |--------------------------------------------------------------------------
        | Cek apakah semua block otorisasi aslap diinspeksi
        |--------------------------------------------------------------------------
        | 
        |
        */
        checkAllBlockInspected(req, res) {
            let now = moment(new Date()).tz('Asia/Jakarta')
            let startOfMonth = new Date(now.year(), now.month() - 1, 1);
            let endOfMonth = new Date(now.year(), now.month(), 0);
            let startOfMonthNumber = parseInt(dateformat(startOfMonth, 'yyyymmdd'));
            let endOfMonthNumber = parseInt(dateformat(endOfMonth, 'yyyymmdd'))
            async.auto({
                getAllAslap: function(callback) {
                    ViewUserAuth.aggregate([
                        { 
                            $match:{
                                $and: [
                                    {
                                        USER_ROLE: 'ASISTEN_LAPANGAN',
                                        $or : [
                                            { REF_ROLE : 'BA_CODE' }, 
                                            { REF_ROLE : 'AFD_CODE' } 
                                        ]
                                    }
                                ]
                            }
                        }
                    ])
                    .then(data => {
                        callback(null, data)
                    })
                    .catch(err => {
                        console.log(err);
                        callback(err);
                        return;
                    })
                },
                getBlockFromEachAslap: ['getAllAslap', function(results, callback) {
                    let aslap = results.getAllAslap;
                    let aslapAndBlocks = [];
                    
                    async.each(aslap, function(a, callbackEach) {
                        let aslapObj = {};
                        aslapObj.USER_AUTH_CODE = a.USER_AUTH_CODE;
                        aslapObj.BLOCKS = [];
                        let locationCodeSplitted = a.LOCATION_CODE.split(',');
                        async.each(locationCodeSplitted, function(locationCode, callbackEach2) {
                            let match = {};
                            match.END_VALID = {
                                $gte: startOfMonthNumber,
                            };
                            if(locationCode.length == 4) {
                                match.WERKS = locationCode;
                            } else if(locationCode.length >= 5) {
                                match.WERKS_AFD_CODE = locationCode;
                            }
                            Block.find(match).select({_id: 0, BLOCK_CODE: 1, WERKS: 1, AFD_CODE: 1, BLOCK_NAME: 1})
                            .then(blocks => {
                                if(blocks.length >= 1) {
                                    for(let i = 0; i < blocks.length; i++) {
                                        blocks[i].WERKS_AFD_BLOCK_CODE = blocks[i].WERKS + blocks[i].AFD_CODE + blocks[i].BLOCK_CODE;
                                        aslapObj.BLOCKS.push(blocks[i]);
                                    }
                                }
                                callbackEach2();
                            })
                            .catch(err => {
                                console.log(err);
                                callbackEach2(err);
                                return;
                            })
                        }, function(err) {
                            if(err) {
                                callback(err, null);
                                return;
                            } else {
                                aslapAndBlocks.push(aslapObj);
                                callbackEach();
                            }
                        })
                    }, function(err) {
                        if(err) {
                            callback(err, null);
                            return;
                        } else {
                            callback(null, aslapAndBlocks);
                        }
                    })
                }],
                getAllInspectedBlock: ['getAllAslap', function(results, callback) {
                    let aslap = results.getAllAslap;
                    let inspectedBlocks = [];
                    async.each(aslap, function(a, callbackEach) {
                        let match = {
                            INSERT_USER: a.USER_AUTH_CODE,
                            INSERT_TIME: {
                                $gte: parseInt(startOfMonthNumber + '000000'),
                                $lte: parseInt(endOfMonthNumber + '235959')
                            }
                        }
                        let block = {};
                        block.USER_AUTH_CODE = a.USER_AUTH_CODE;
                        block.BLOCKS = [];
                        InspectionH.aggregate([
                            {
                                $match: match
                            }, {
                                $project: {
                                    _id: 0,
                                    INSERT_TIME: 1,
                                    WERKS : 1,
                                    AFD_CODE : 1,
                                    BLOCK_CODE : 1
                                }
                            }
                        ])
                        .then(data => {
                            if(data.length != 0) {
                                for(let i = 0; i < data.length; i++) {
                                    data[i].WERKS_AFD_BLOCK_CODE = data[i].WERKS + data[i].AFD_CODE + data[i].BLOCK_CODE;
                                }
                                block.BLOCKS = data;
                            } 
                            inspectedBlocks.push(block);
                            callbackEach();
                        })
                        .catch(err => {
                            console.log(err);
                            callbackEach(err, null);
                        })
                    }, function(err) {
                        if(err) {
                            callback(err, null);
                            return;
                        } else {
                            callback(null, inspectedBlocks);
                        }
                    })
                }],
                compareInspectedBlockAndBlockAuthorization: ['getBlockFromEachAslap', 'getAllInspectedBlock', function(result, callback) {
                    let otorisasiBlock = result.getBlockFromEachAslap;
                    let inspectedBlock = result.getAllInspectedBlock;
                    let pointAslap = [];
                    
                    async.each(otorisasiBlock, function(otorisasi, callbackEach) {
                        let point = {};
                        let userAuthCode = otorisasi.USER_AUTH_CODE;
                        point.POINT = 0;
                        point.USER_AUTH_CODE = userAuthCode;
                        async.each(otorisasi.BLOCKS, function(ot, callbackEach2) {
                            let werksAfdBlockCode = ot.WERKS_AFD_BLOCK_CODE;
                            let found = inspectedBlock.find(ins => ins.WERKS_AFD_BLOCK_CODE === werksAfdBlockCode);
                            if(!found) {
                                point.POINT -= 10;
                                if(userAuthCode == '0216') {
                                    let history = new History({
                                        USER_AUTH_CODE: userAuthCode,
                                        POINT: -10,
                                        BA_CODE: ot.WERKS,
                                        PERIOD: endOfMonthNumber,
                                        DATE: endOfMonthNumber,
                                        TYPE: 'INSPEKSI',
                                        REMARKS: 'Blok tidak diinspeksi',
                                        REFERENCE: `${ot.WERKS}/${ot.AFD_CODE}/${ot.BLOCK_CODE}/${ot.BLOCK_NAME}`
                                    });
                                    history.save()
                                    .then(() => {
                                        let set = new Point({
                                            USER_AUTH_CODE: userAuthCode, 
                                            LOCATION_CODE: ot.WERKS,
                                            MONTH: endOfMonthNumber,
                                            POINT: -10,
                                            LAST_INSPECTION_DATE: 0
                                        });
                                        set.save()
                                        .then(data => {
                                            console.log('berhasil save', userAuthCode);
                                        })
                                        .catch(err => {
                                            Point.updateOne({
                                                USER_AUTH_CODE: userAuthCode,
                                                LOCATION_CODE: ot.WERKS,
                                                MONTH: endOfMonthNumber,
                                            }, {
                                                $inc: {
                                                    POINT: -10
                                                }
                                            })
                                            .then( () => {
                                                console.log("sukses update", userAuthCode)
                                            })
                                            .catch(err => {
                                                console.log(err);
                                            });
                                        });
                                    })
                                    .catch(err => {
                                        console.log(err);
                                        callbackEach2(err);
                                        return;
                                    })
                                }
                            }
                            callbackEach2();
                        }, function(err) {
                            if(err) {
                                callbackEach(err);
                                return;
                            } else {
                                pointAslap.push(point);
                                callbackEach();
                            }
                        })

                    }, function(err) {
                        if(err) {
                            callback(err, null);
                            return;
                        } else {
                            callback(null, pointAslap);
                        }
                    })
                }]
            }, function(err, results) {
                res.send({
                    status: true,
                    message: 'success',
                    data: results.checkIsHoliday
                })
            });
        }
        
    }



    module.exports = new Cron();
