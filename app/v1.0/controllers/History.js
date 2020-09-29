/*
 |--------------------------------------------------------------------------
 | App Setup
 |--------------------------------------------------------------------------
 |
 | Untuk menghandle models, libraries, helper, node modules, dan lain-lain
 |
 */
    
    const History = require( _directory_base + '/app/v1.0/models/History.js' );
    const dateformat = require('dateformat');
    
    //Node_modules
    const async = require('async');

    exports.report = async (req, res) => {
        let month = req.params.month;
        // try {
        async.auto({
            getAllHistory: function(callback) {
                History.find({ PERIOD: month }).select({ _id: 0 })
                .then(data => {
                    callback(null, data);
                })
                .catch(err => {
                    console.log(err)
                    callback(err, null);
                });
            }, 
            mappingData: ['getAllHistory', function(results,  callback) {
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
            }]
        }, function(err, results) {
            if(err) {
                return res.send({
                    status: false,
                    message: 'Internal Server error',
                    data: []
                })
            }
            console.log(results.mappingData)
            res.send({
                status: true,
                message: 'Success',
                data: results.mappingData
            });
        })
        
    }