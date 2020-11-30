/*
|--------------------------------------------------------------------------
| Variable
|--------------------------------------------------------------------------
*/
    const kafka = require( 'kafka-node' );
    const dateformat = require('dateformat');
    const moment = require( 'moment-timezone');

    //Models
    const Models = {
        Point: require( _directory_base + '/app/v1.0/models/Point.js'),
        KafkaPayload: require( _directory_base + '/app/v1.0/models/KafkaPayload.js'),
        ViewUserAuth: require( _directory_base + '/app/v1.0/models/ViewUserAuth.js'),
        InspectionH: require( _directory_base + '/app/v1.0/models/InspectionH.js'),
    }

/*
|--------------------------------------------------------------------------
| Kafka Server Library
|--------------------------------------------------------------------------
|
| Apache Kafka is an open-source stream-processing software platform 
| developed by LinkedIn and donated to the Apache Software Foundation, 
| written in Scala and Java. The project aims to provide a unified, 
| high-throughput, low-latency platform for handling real-time data feeds.
|
*/
	class Kafka {
		async consumer () {
            const ConsumerGroup = kafka.ConsumerGroup;
			var options = {
				// connect directly to kafka broker (instantiates a KafkaClient)
				kafkaHost: config.app.kafka[config.app.env].server_host,
				groupId: "INS_MSA_POINT_GROUP",
				autoCommit: false,
				// autoCommitIntervalMs: 5000,
				sessionTimeout: 15000,
				fetchMaxBytes: 10 * 1024 * 1024, // 10 MB
				// An array of partition assignment protocols ordered by preference. 'roundrobin' or 'range' string for
				// built ins (see below to pass in custom assignment protocol)
				protocol: ['roundrobin'],
				// Offsets to use for new groups other options could be 'earliest' or 'none'
				// (none will emit an error if no offsets were saved) equivalent to Java client's auto.offset.reset
				fromOffset: 'latest',
				// how to recover from OutOfRangeOffset error (where save offset is past server retention)
				// accepts same value as fromOffset
                outOfRangeOffset: 'earliest',
                commitOffsetsOnFirstJoin: true, // on the very first time this consumer group subscribes to a topic, record the offset returned in fromOffset (latest/earliest)
				// Callback to allow consumers with autoCommit false a chance to commit before a rebalance finishes
				// isAlreadyMember will be false on the first connection, and true on rebalances triggered after that
				onRebalance: (isAlreadyMember, callback) => { callback(); } // or null
			};
			let consumerGroup = new ConsumerGroup(options, ['INS_MSA_FINDING_TR_FINDING', 'INS_MSA_INS_TR_BLOCK_INSPECTION_H', 'INS_MSA_INS_TR_INSPECTION_GENBA', 'INS_MSA_EBCCVAL_TR_EBCC_VALIDATION_H']);
			console.log(config.app.kafka[config.app.env])
			consumerGroup.on('message', async (message) => {
				try {
					if (message) {
                        if (message.topic && message.value) {
                            try {
                                console.log(message.value);
                                this.save(message, consumerGroup);
                                
                            } catch (err) {
                                console.log(err);
                            }
                        }
                    }
				} catch(err) {
					console.log(err)
				}
			});
		
			consumerGroup.on('error', function onError(error) {
				console.error(error);
			});
        }
        async save(message, consumerGroup) {
            try {
                let now = moment(new Date()).tz('Asia/Jakarta')
                let endOfMonth = new Date(now.year(), now.month() + 1, 0);
                let dateNumber = parseInt(dateformat(endOfMonth, 'yyyymmdd')); //misalnya 20203101
                let data = JSON.parse(message.value);
                let topic = message.topic;
                let inspectionDate = parseInt(moment( new Date() ).tz( "Asia/Jakarta" ).format( "YYYYMMDDHHmmss" ));
                let werks = data.WERKS;
                let remarks;
                if (topic === 'INS_MSA_FINDING_TR_FINDING') {

                    //jika finding sudah selesai, maka lakukan perhitungan point
                    if (data.END_TIME != "" && data.RTGVL == 0) {
                        // let endTimeNumber = parseInt(data.END_TIME.substring(0, 8));
                        // let dueDate = parseInt(data.DUE_DATE.substring(0, 8));
                        //jika finding sudah diselesaikan dan tidak overdue dapat 1 point ,
                        
                        remarks = 'selesai 1 transaksi';
                        // if (endTimeNumber <= dueDate) {
                        this.updatePoint(data.UPTUR, 5, dateNumber, null, werks, consumerGroup);
                        // }
                        
                        //update point user yang membuat finding
                        // this.updatePoint(data.INSUR, 2, dateNumber, null, werks);
                        //memberi tambahan point sesuai rating yang diberikan
                        
                    } else if (data.END_TIME != "" && data.RTGVL != 0) {
                        let ratings = [1, 2, 3, 4];
                        let ratingMessage = [
                            "rating BAD",
                            "rating OK",
                            "rating GOOD",
                            "rating GREAT",
                        ];
                        for (let i = 0; i < ratings.length; i++) {
                            if (data.RTGVL == ratings[i]) {
                                remarks = ratingMessage[i];
                                this.updatePoint(data.UPTUR, ratings[i] - 2, dateNumber, null, werks, consumerGroup);
                                break;
                            }
                        }
                    } 
                } else if (topic === 'INS_MSA_INS_TR_BLOCK_INSPECTION_H') {
                    remarks = '1 baris';
                    this.updatePoint(data.INSUR, 1, dateNumber, inspectionDate, werks, consumerGroup);
                } else if (topic === 'INS_MSA_INS_TR_INSPECTION_GENBA') {
                    remarks = '1 transaksi';
                    let inspection = await Models.InspectionH.findOne({BLOCK_INSPECTION_CODE: data.BINCH}).select({_id: 0, BLOCK_INSPECTION_CODE: 1, WERKS: 1, INSERT_TIME: 1});
                    let blockInspectionCode = inspection.BLOCK_INSPECTION_CODE;
                    let werksGenba = inspection.WERKS;
                    let insertTime = inspection.INSERT_TIME;
                    this.updatePoint(data.GNBUR, 1, dateNumber, inspectionDate, werksGenba, consumerGroup); 
                } else if (topic === 'INS_MSA_EBCCVAL_TR_EBCC_VALIDATION_H') {
                    remarks = '1 transaksi';
                    this.updatePoint(data.INSUR, 1, dateNumber, inspectionDate, werks, consumerGroup);
                }
            } catch (err) {
                console.log(err);
            }
        }

        //tambahkan point user
        async updatePoint(userAuthCode, point, dateNumber, inspectionDate = 0, werks, consumerGroup) {
            console.log(werks);
            let set = new Models.Point({
                USER_AUTH_CODE: userAuthCode, 
                LOCATION_CODE: werks,
                MONTH: dateNumber,
                POINT: point,
                LAST_INSPECTION_DATE: inspectionDate
            });
            // console.log(set);
            await set.save()
            .then(data => {
                console.log('berhasil save');
                this.commitOffset(consumerGroup);
            })
            .catch(err => {
                if (inspectionDate != 0) {
                    Models.Point.updateOne({
                        USER_AUTH_CODE: userAuthCode,
                        LOCATION_CODE: werks,
                        MONTH: dateNumber,
                    }, {
                        LAST_INSPECTION_DATE: inspectionDate,
                        $inc: {
                            POINT: point
                        }
                    })
                    .then( () => {
                        console.log("sukses update", userAuthCode)
                        this.commitOffset(consumerGroup);
                    })
                    .catch(err => {
                        console.log(err);
                    });
                } else {
                    Models.Point.updateOne({
                        USER_AUTH_CODE: userAuthCode,
                        MONTH: dateNumber,
                        LOCATION_CODE: werks,
                    }, {
                        $inc: {
                            POINT: point
                        }
                    })  
                    .then( (data) => {
                        console.log("sukses update", userAuthCode);
                        this.commitOffset(consumerGroup);
                    })
                    .catch(err => {
                        console.log(err);
                    });
                }
            });
        }

        commitOffset(consumerGroup) {
            setTimeout(() => {
                consumerGroup.commit((error, data) => {
                    // Here the commit will work as expected
                    console.log('succesfully committed');
                });
            }, 0);
        }
        
        // async saveToHistory(userAuthCode, point, period, dateNumber, type, remarks, werks,reference) {
        //     try {
        //         dateNumber = parseInt(dateNumber.toString().substring(0, 8));
        //         let history = new Models.History({
        //             USER_AUTH_CODE: userAuthCode,
        //             POINT: point,
        //             BA_CODE: werks,
        //             PERIOD: period,
        //             DATE: dateNumber,
        //             TYPE: type,
        //             REMARKS: remarks,
        //             REFERENCE: reference
        //         });
        //         await history.save();
        //         console.log('berhasil simpan ke history: ' + reference);
        //     } catch(err) {
        //         console.log(err);
        //     }
        // }
    }
    

/*
|--------------------------------------------------------------------------
| Module Exports
|--------------------------------------------------------------------------
*/
	module.exports = new Kafka();