
const { v4: uuidv4 } = require("uuid");
const bcrypt = require("bcryptjs");
const nodemailer = require("nodemailer");
const express = require("express");
const { onRequest } = require("firebase-functions/v2/https");  
const admin = require("firebase-admin");
const cors = require("cors");

const app = express();
var serviceAccount = require("./key.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

app.use(cors({origin: true}));

app.get('/test', (req, res) => {
  return res.status(200).send('Express is live');
});

app.post('/api/register/', async (req, res)=>{
    try{

        const profile = req.body;
        const pas = uuidv4().slice(0, 8);
        const epas = await bcrypt.hash(pas, 10);
        profile.password = epas;

        const transporter = nodemailer.createTransport({
            service: 'Gmail',
            auth: {
              user: 'yashjec77@gmail.com',
              pass: 'fktc xiiy venm vrhs',
            },
          });
      
          const mailOptions = {
            from: 'saxenay117@gmail.com',
            to: profile.email,
            subject: 'JLUG Interview Desk Account Password',
            text: `Hello👋 ${profile.name} ! Here is your password for JLUG Interview Desk : ${pas}`,
          };
      
          let sent = await transporter.sendMail(mailOptions);

          if(sent.accepted.length > 0){
            let doc = await db.collection('users').add(profile);
            return res.status(200).json({message:'Registerd'});
          }
          else{
            return res.status(500).send({error : 'Error sending mail'})
          }

    }
    catch(e){
        console.log(e);
        res.status(500).send(e.message);
    }
})



app.post('/api/login', async (req, res) => {
    try {
        const { email, pass } = req.body;

        if (!email || !pass) {
            return res.status(400).send({message : 'Email id and password is required'});
        }

        const usersRef = db.collection('users');
        const querySnapshot = await usersRef.where('email', '==', email).limit(1).get(); 

        if (querySnapshot.empty) {
            return res.status(401).send({message : 'Invalid email or password'});
        }

        const userDoc = querySnapshot.docs[0]; 
        const user = userDoc.data();

        console.log(user)

        const validPassword = await bcrypt.compare(pass, user.password);


        if (!validPassword) {
            return res.status(401).send({message : 'User not found'});
        }

        return res.status(200).send({
            message: 'Login successful',
            user: user
        });

    } catch (error) {
        console.error('Error during login', error);
        return res.status(500).send({ message : 'Server error during login.'});
    }
});

exports.app = onRequest(app);
