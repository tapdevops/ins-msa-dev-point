/*
 |--------------------------------------------------------------------------
 | App Setup
 |--------------------------------------------------------------------------
 |
 | Untuk menghandle models, libraries, helper, node modules, dan lain-lain
 |
 */
    //Models
    const Est = require(_directory_base + '/app/v1.0/models/Est.js');
    const History = require( _directory_base + '/app/v1.0/models/History.js' );
    
    //Node_modules
    const dateformat = require('dateformat');
    const async = require('async');

    exports.report = async (req, res) => {
        let month = req.params.month;
        // try {
        async.auto({
            getAllHistory: function(callback) {
                History.aggregate([
                    {
                        $lookup: {
                            from: "VIEW_USER_AUTH",
                            foreignField: "USER_AUTH_CODE",
                            localField: "USER_AUTH_CODE",
                            as: "viewUser"
                        }
                    },{
                        $unwind: "$viewUser" 
                    }, {
                        $project: {
                            _id: 0,
                            FULLNAME: {$ifNull: ["$viewUser.HRIS_FULLNAME", "$viewUser.PJS_FULLNAME"]},
                            NIK: "$viewUser.EMPLOYEE_NIK",
                            JOB: "$viewUser.USER_ROLE",
                            BA_CODE: 1,
                            POINT: 1,
                            USER_AUTH_CODE : 1,
                            PERIOD: 1,
                            DATE: 1,
                            TYPE: 1,
                            REMARKS: 1,
                            REFERENCE: 1
                        }
                    }, {
                        $match: {
                            PERIOD: parseInt(month),
                            JOB: 'ASISTEN_LAPANGAN'
                        } 
                    }
                ])
                .then(data => {
                    // console.log(data);
                    callback(null, data);
                })
                .catch(err => {
                    console.log(err)
                    callback(err, null);
                });
            }, 
            mappingPeriode: ['getAllHistory', function(results,  callback) {
                let histories = results.getAllHistory;
                histories.map(async (history) => {
                    let date = history.DATE.toString();
                    let year = date.substring(0, 4);
                    let month = date.substring(4, 6);
                    let day = date.substring(6, 8);
                    let periode = new Date(`${month}/${day}/${year}`);
                    periode = dateformat(periode, 'mm/dd/yyyy');
                    history.DATE = periode;
                });
                callback(null, histories)
            }],
            getEstateName: ['mappingPeriode', function(results, callback) {
                let histories = results.mappingPeriode;
                async.each(histories, function(history, callbackEach) {
                    Est.findOne({WERKS: history.BA_CODE}).select({_id: 0, EST_NAME: 1})
                    .then( data => {
                        history.BUSINESS_AREA = data.EST_NAME;
                        callbackEach();
                    })
                    .catch(err => {
                        console.log(err);
                        callbackEach(err, null);
                    });
                }, function(err) {
                    if (err) {
                        callback(err, null);
                        return;
                    } else {
                        callback(null, histories);
                    }
                })     
            }]
        }, function(err, results) {
            if(err) {
                return res.send({
                    status: false,
                    message: 'Internal Server error',
                    data: []
                })
            }
            // console.log(results.mappingData)
            res.send({
                status: true,
                message: 'Success',
                data: results.getEstateName
            });
        })
        
    }