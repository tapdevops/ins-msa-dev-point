/*
|--------------------------------------------------------------------------
| Variable
|--------------------------------------------------------------------------
*/
    
    // Models
	// const FindingModel = require( _directory_base + '/app/v2.0/Http/Models/Finding.js' );
	// const SummaryWeeklyModel = require( _directory_base + '/app/v2.0/Http/Models/SummaryWeekly.js' );
    // const Notification = require( _directory_base + '/app/v2.1/Http/Models/Notification.js' );
    const InspectionH = require( _directory_base + '/app/v1.0/models/InspectionH.js' );
	const Block = require( _directory_base + '/app/v1.0/models/Block.js' );
    const ViewUserAuth = require( _directory_base + '/app/v1.0/models/ViewUserAuth.js' );
    
	// Node Module
    // const MomentTimezone = require( 'moment-timezone' );
    const async = require('async');
    // const dateformat = require('dateformat');
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
        | Hitung target daily inspection setiap aslap
        |--------------------------------------------------------------------------
        | 
        |
        */
        async checkDailyInspection() {

        }
        /*
        |--------------------------------------------------------------------------
        | Cek apakah semua block otorisasi aslap diinspeksi
        |--------------------------------------------------------------------------
        | 
        |
        */
        checkAllBlockInspected() {
            let now = moment(new Date()).tz('Asia/Jakarta')
            let startOfMonth = new Date(now.year(), now.month(), 1);
            let endOfMonth = new Date(now.year(), now.month() + 1, 0);
            let startOfMonthNumber = parseInt(dateformat(startOfMonth, 'yyyymmdd'));
            let endOfMonthNumber = parseInt(dateformat(endOfMonth, 'yyyymmdd'));
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
                        aslapObj.LOCATION_CODE = a.LOCATION_CODE;
                        let locationCodeSplitted = a.LOCATION_CODE.split(',');
                        async.each(locationCodeSplitted, function(locationCode, callbackEach2) {
                            let match = {};
                            match.END_VALID = {
                                $gte: startOfMonthNumber,
                                $lte: endOfMonthNumber
                            };
                            if(locationCode.length == 4) {
                                match.WERKS = locationCode;
                            } else if(locationCode.length >= 5) {
                                match.WERKS_AFD_CODE = locationCode;
                            }
                            Block.find(match).select({_id: 0, BLOCK_CODE: 1, WERKS: 1, AFD_CODE: 1, BLOCK_NAME: 1})
                            .then(blocks => {
                                // console.log(blocks);
                                aslapObj.BLOCKS = blocks;
                                callbackEach2();
                            })
                            .catch(err => {
                                callbackEach2(err);
                                return;
                            })
                        }, function(err) {
                            if(err) {
                                callback(err, null);
                                return;
                            } else {
                                // console.log(aslapObj);
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
                    InspectionH.aggregate([
                        {
                            $match: {
                                INSERT_USER: aslap.USER_AUTH_CODE,
                                INSERT_TIME: {
                                    $gte: parseInt(startOfMonthNumber + '000000'),
                                    $lte: parseInt(endOfMonthNumber + '235959')
                                }
                            }
                        }, {
                            $project: {
                                _id: 0,
                                WERKS : 1,
                                AFD_CODE : 1,
                                BLOCK_CODE : 1
                            }
                        }
                    ])
                    .then(data => {
                        callback(null, data);
                    })
                    .catch(err => {
                        console.log(err);
                        callback(err, null);
                    })
                }],
                compareInspectedBlockAndBlockAuthorization: ['getBlockFromEachAslap', 'getAllInspectedBlock', function(result, callback) {
                    let otorisasiBlock = result.getBlockFromEachAslap;
                    let inspectedBlock = result.getAllInspectedBlock;
                    console.log(inspectedBlock);
                    callback('mantap');
                }]
            }, function(err, results) {
                // console.log(results.getBlockFromEachAslap);
                console.log('finish');
            });
        }
        
    }



    module.exports = new Cron();
