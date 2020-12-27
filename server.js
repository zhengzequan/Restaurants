const express = require('express');
const app = express();
const MongoClient = require('mongodb').MongoClient;
const ObjectID = require('mongodb').ObjectID;
const assert = require('assert');
const fs = require('fs');
const formidable = require('express-formidable');
const mongourl = 'mongodb+srv://Peter:Zzq543111584@cluster0.zytzr.mongodb.net/test?retryWrites=true&w=majority';
const dbName = 'test';
const session = require('cookie-session');
const bodyParser = require('body-parser');

const SECRETKEY = 'I want to pass COMPS381F';

const users = new Array(
	{name: 'demo', password: 'demo'},
	{name: 'student', password: 'student'}
);

app.use(formidable());
app.set('view engine', 'ejs');
app.use(session({
    name: 'loginSession',
    keys: [SECRETKEY]
  }));

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

const findDocument = (db, criteria, callback) => {
    let cursor = db.collection('bookings').find(criteria);
    console.log(`findDocument: ${JSON.stringify(criteria)}`);
    cursor.toArray((err,docs) => {
        assert.equal(err,null);
        console.log(`findDocument: ${docs.length}`);
        callback(docs);
    });
}

const handle_Find = (res, criteria) => {
    const client = new MongoClient(mongourl);
    client.connect((err) => {
        assert.equal(null, err);
        console.log("Connected successfully to server");
        const db = client.db(dbName);

        findDocument(db, criteria, (docs) => {
            client.close();
            console.log("Closed DB connection");
            res.status(200).render('list',{nBookings: docs.length, bookings: docs});
        });
    });
}

const handle_Details = (res, criteria) => {
    const client = new MongoClient(mongourl);
    client.connect((err) => {
        assert.equal(null, err);
        console.log("Connected successfully to server");
        const db = client.db(dbName);

        /* use Document ID for query */
        let DOCID = {};
        DOCID['_id'] = ObjectID(criteria._id)
        findDocument(db, DOCID, (docs) => {  // docs contain 1 document (hopefully)
            client.close();
            console.log("Closed DB connection");
            res.status(200).render('details', {booking: docs[0]});
        });
    });
}

const handle_Edit = (res, criteria) => {
    const client = new MongoClient(mongourl);
    client.connect((err) => {
        assert.equal(null, err);
        console.log("Connected successfully to server");
        const db = client.db(dbName);

        /* use Document ID for query */
        let DOCID = {};
        DOCID['_id'] = ObjectID(criteria._id)
        let cursor = db.collection('bookings').find(DOCID);
        cursor.toArray((err,docs) => {
            client.close();
            assert.equal(err,null);
            res.status(200).render('edit',{booking: docs[0]});
        });
    });
}

const updateDocument = (criteria, updateDoc, callback) => {
    const client = new MongoClient(mongourl);
    client.connect((err) => {
        assert.equal(null, err);
        console.log("Connected successfully to server");
        const db = client.db(dbName);

         db.collection('bookings').updateOne(criteria,
            {
                $set : updateDoc
            },
            (err, results) => {
                client.close();
                assert.equal(err, null);
                callback(results);
            }
        );
    });
}

const handle_Update = (req, res, criteria) => {

        var DOCID = {};
        DOCID['_id'] = ObjectID(req.fields._id);
        var updateDoc = {};
        updateDoc['borough'] = req.fields.borough;
        updateDoc['cuisine'] = req.fields.cuisine;
        updateDoc['building'] = req.fields.building;
        updateDoc['zipcode'] = req.fields.zipcode;
        updateDoc['lon'] = req.fields.lon;
        updateDoc['lat'] = req.fields.lat;
        updateDoc['score'] = req.fields.score;
        if (req.files.filetoupload.size > 0) {
            fs.readFile(req.files.filetoupload.path, (err,data) => {
                assert.equal(err,null);
                updateDoc['photo'] = new Buffer.from(data).toString('base64');
                updateDocument(DOCID, updateDoc, (results) => {
                    res.status(200).render('info', {message: `Updated ${results.result.nModified} document(s)`})
                });
            });
        } else {
            updateDocument(DOCID, updateDoc, (results) => {
                res.status(200).render('info', {message: `Updated ${results.result.nModified} document(s)`})
            });
        }
}

app.use((req,res,next) => {
    let d = new Date();
    console.log(`TRACE: ${req.path} was requested at ${d.toLocaleDateString()}`);  
    next();
})

app.get("/map", (req,res) => {
	res.render("leaflet.ejs");
	res.end();
});


app.get('/', (req,res) => {

		res.redirect('/find');;

})

app.get('/login', (req,res) => {
	res.status(200).render('login',{});
});

app.post('/login', (req,res) => {
	users.forEach((user) => {
		if (user.name == req.body.name && user.password == req.body.password) {
			// correct user name + password
			// store the following name/value pairs in cookie session
			req.session.authenticated = true;        // 'authenticated': true
			req.session.username = req.body.name;	 // 'username': req.body.name		
		}
	});
	res.redirect('/');
});

app.get('/logout', (req,res) => {
	req.session = null;   // clear cookie-session
	res.redirect('/');
});

app.get('/find', (req,res) => {
    handle_Find(res, req.query.docs);
})

app.get('/details', (req,res) => {
    handle_Details(res, req.query);
})

app.get('/edit', (req,res) => {
    handle_Edit(res, req.query);
})

app.post('/update', (req,res) => {
    handle_Update(req, res, req.query);
})


app.post('/api/booking/:restaurant_id', (req,res) => {
    if (req.params.bookingid) {
        console.log(req.body)
        const client = new MongoClient(mongourl);
        client.connect((err) => {
            assert.equal(null,err);
            console.log("Connected successfully to server");
            const db = client.db(dbName);
            let newDoc = {};
            newDoc['restaurant_id'] = req.fields.bookingid;
            newDoc['mobile'] = req.fields.mobile;
            if (req.files.filetoupload && req.files.filetoupload.size > 0) {
                fs.readFile(req.files.filetoupload.path, (err,data) => {
                    assert.equal(err,null);
                    newDoc['photo'] = new Buffer.from(data).toString('base64');
                    db.collection('bookings').insertOne(newDoc,(err,results) => {
                        assert.equal(err,null);
                        client.close()
                        res.status(200).end()
                    })
                });
            } else {
                db.collection('bookings').insertOne(newDoc,(err,results) => {
                    assert.equal(err,null);
                    client.close()
                    res.status(200).end()
                })
            }
        })
    } else {
        res.status(500).json({"error": "missing Restaurant ID"});
    }
})


app.get('/api/booking/:restaurant_id', (req,res) => {
    if (req.params.bookingid) {
        let criteria = {};
        criteria['restaurant_id'] = req.params.bookingid;
        const client = new MongoClient(mongourl);
        client.connect((err) => {
            assert.equal(null, err);
            console.log("Connected successfully to server");
            const db = client.db(dbName);

            findDocument(db, criteria, (docs) => {
                client.close();
                console.log("Closed DB connection");
                res.status(200).json(docs);
            });
        });
    } else {
        res.status(500).json({"error": "missing Restaurant ID"});
    }
})

app.put('/api/booking/:restaurant_id', (req,res) => {
    if (req.params.bookingid) {
        console.log(req.body)
        const client = new MongoClient(mongourl);
        client.connect((err) => {
            assert.equal(null,err);
            console.log("Connected successfully to server");
            const db = client.db(dbName);

            let criteria = {}
            criteria['restaurant_id'] = req.params.bookingid

            let updateDoc = {};
            Object.keys(req.fields).forEach((key) => {
                updateDoc[key] = req.fields[key];
            })
            console.log(updateDoc)
            if (req.files.filetoupload && req.files.filetoupload.size > 0) {
                fs.readFile(req.files.filetoupload.path, (err,data) => {
                    assert.equal(err,null);
                    newDoc['photo'] = new Buffer.from(data).toString('base64');
                    db.collection('bookings').updateOne(criteria, {$set: updateDoc},(err,results) => {
                        assert.equal(err,null);
                        client.close()
                        res.status(200).end()
                    })
                });
            } else {
                db.collection('bookings').updateOne(criteria, {$set: updateDoc},(err,results) => {
                    assert.equal(err,null);
                    client.close()
                    res.status(200).end()
                })
            }
        })
    } else {
        res.status(500).json({"error": "missing Restaurant ID"});
    }
})

app.delete('/api/booking/:restaurant_id', (req,res) => {
    if (req.params.bookingid) {
        let criteria = {};
        criteria['restaurant_id'] = req.params.bookingid;
        const client = new MongoClient(mongourl);
        client.connect((err) => {
            assert.equal(null, err);
            console.log("Connected successfully to server");
            const db = client.db(dbName);

            db.collection('bookings').deleteMany(criteria,(err,results) => {
                assert.equal(err,null)
                client.close()
                res.status(200).end();
            })
        });
    } else {
        res.status(500).json({"error": "missing Restaurant ID"});       
    }
})
//
// End of Restful
//


app.get('/*', (req,res) => {
    //res.status(404).send(`${req.path} - Unknown request!`);
    res.status(404).render('info', {message: `${req.path} - Unknown request!` });
})

app.listen(app.listen(process.env.PORT || 8099));
