
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
            console.log(profile)
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
            userID:userDoc.id,
            user: user
        });

    } catch (error) {
        console.error('Error during login', error);
        return res.status(500).send({ message : 'Server error during login.'});
    }
});

app.post('/add-task', async (req, res) => {
  const { tname, tdesc, tcatg, tstat, tsub, tdead, tfileUrl, by, adminid } = req.body;

  try {
    const taskRef = db.collection('tasks').doc();
    await taskRef.set({
      tname,
      tdesc,
      tcatg,
      tstat,
      tsub,
      tdead,
      tfileUrl, 
      by,
      adminid
    });

    res.status(200).send({ message: 'Task successfully added!' });
  } catch (error) {
    res.status(500).send({ message: 'Error saving task to Firebase', error });
  }
});


app.get('/get-tasks', async (req, res) => {
  try {
    const snapshot = await db.collection('tasks').get();
    const tasks = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    res.status(200).send(tasks);
  } catch (error) {
    res.status(500).send({ message: 'Error fetching tasks from Firebase', error });
  }
});

app.get('/tasks/:id', async (req, res) => {
  try {
    const taskRef = db.collection('tasks').doc(req.params.id);
    const task = await taskRef.get();

    if (!task.exists) {
      return res.status(404).send({ message: 'Task not found' });
    }

    res.status(200).send(task.data());
  } catch (error) {
    res.status(500).send({ message: 'Error fetching task', error });
  }
});

app.post('/api/submit-task', async (req, res) => {
  const { taskId, submissionUrl, userId } = req.body;

  try {
    const submissionRef = db.collection('submissions').doc(); 
    const submissionData = {
      taskId,
      submissionUrl,
      userId,
    };

    await submissionRef.set(submissionData);

    res.status(200).send({
      message: 'Submission created successfully',
      submissionId: submissionRef.id,
    });
  } catch (error) {
    console.error('Error creating submission:', error.message);
    res.status(500).send({ error: 'Failed to create submission' });
  }
});

app.post('/api/update/:userId', async (req, res) => {
  const { userId } = req.params; 
  console.log('Fetching user with ID:', userId);
  const { submissionId } = req.body;
  console.log(userId, submissionId)

  try {
    const userRef = db.collection('users').doc(userId); 

    const userDoc = await userRef.get();
    console.log(userDoc)

    if (!userDoc.exists) {
      return res.status(404).send({ error: 'User not found' });
    }

    const userData = userDoc.data();
    const updatedSubmissions = [...(userData.submissions || []), submissionId];
    await userRef.update({ submissions: updatedSubmissions });

    res.status(200).send({ message: 'User submissions updated successfully' });
  } catch (error) {
    console.error('Error updating user submissions:', error.message);
    res.status(500).send({ error: 'Failed to update user submissions' });
  }
});



app.get('/api/get-user/:userId', async (req, res) => {
  const { userId } = req.params; 
  console.log('Fetching user with ID:', userId);

  try {
    const userRef = db.collection('users').doc(userId); 
    const userDoc = await userRef.get(); 
    console.log(userDoc)

    if (!userDoc.exists) {
      console.log(`User with ID ${userId} not found.`);
      return res.status(404).send({ message: 'User not found.' });
    }

    const userData = { id: userDoc.id, ...userDoc.data() }; 
    console.log('User data:', userData);
    res.status(200).send(userData); 
  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).send({ error: 'Failed to fetch user.' });
  }
});


app.get('/pending/:adminId', async (req, res) => {
  const { adminId } = req.params;

  console.log(adminId);
  try {
    const usersRef = admin.firestore().collection('users');
    const snapshot = await usersRef
      .where('ups', '==', 0)
      .where('downs', '==', 0)
      .where('isblacklisted', '==', 'no')
      .get();

    if (snapshot.empty) {
      return res.status(200).json([]);
    }

    const pendingApplicants = snapshot.docs
      .map(doc => ({ id: doc.id, ...doc.data() }))
      .filter(
        user => !((user.email || '').includes('admin')) &&
                !(user.approvedby || []).includes(adminId)
      );

    res.status(200).json(pendingApplicants);
  } catch (error) {
    console.error('Error fetching pending applicants:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});


app.get('/api/get-submissions/:userId', async (req, res) => {
  const { userId } = req.params;

  try {
    const userDoc = await db.collection('users').doc(userId).get();
    if (!userDoc.exists) {
      return res.status(404).send({ message: 'User not found.' });
    }

    const userData = userDoc.data();
    const submissionIds = userData.submissions || [];

    if (submissionIds.length === 0) {
      return res.status(200).send([]); 
    }

    const results = [];

    for (const submissionId of submissionIds) {
      const submissionDoc = await db.collection('submissions').doc(submissionId).get();
      if (!submissionDoc.exists) {
        console.warn(`Submission with ID ${submissionId} not found.`);
        continue;
      }

      const submissionData = submissionDoc.data();

      const taskDoc = await db.collection('tasks').doc(submissionData.taskId).get();
      if (!taskDoc.exists) {
        console.warn(`Task with ID ${submissionData.taskId} not found.`);
        continue;
      }

      const taskData = taskDoc.data();

      results.push({
        taskName: taskData.tname, 
        fileUrl: submissionData.submissionUrl,
      });
    }

    console.log(results)

    res.status(200).send(results); 
  } catch (error) {
    console.error('Error fetching user submissions:', error);
    res.status(500).send({ error: 'Failed to fetch user submissions.' });
  }
});


app.post('/api/upvote', async (req, res) => {
  const { adminId, userId } = req.body;
  console.log(adminId, userId)

  try {
    const userRef = db.collection('users').doc(userId);
    const adminRef = db.collection('users').doc(adminId);

    const userDoc = await userRef.get();
    const adminDoc = await adminRef.get();

    if (!userDoc.exists || !adminDoc.exists) {
      return res.status(404).send({ message: 'User or Admin not found.' });
    }

    const userData = userDoc.data();
    const adminData = adminDoc.data();

    
    if (userData.approvedby && userData.approvedby.includes(adminId)) {
      return res.status(400).send({ message: 'Admin has already approved this user.' });
    }

    await userRef.update({ ups: userData.ups + 1 });
    await userRef.update({ approvedby: adminData.approvedby ? [...adminData.approvedby, adminId] : [adminId] });

    await adminRef.update({ approvedby: adminData.approvedby ? [...adminData.approvedby, userId] : [userId] });

    return res.status(200).send({ message: 'Upvoted successfully.' });
  } catch (error) {
    console.error('Error during upvote:', error);
    return res.status(500).send({ message: 'Server error during upvote.' });
  }
});

app.post('/api/downvote', async (req, res) => {
  const { adminId, userId } = req.body;

  try {
    const userRef = db.collection('users').doc(userId);
    const adminRef = db.collection('users').doc(adminId);

    const userDoc = await userRef.get();
    const adminDoc = await adminRef.get();

    if (!userDoc.exists || !adminDoc.exists) {
      return res.status(404).send({ message: 'User or Admin not found.' });
    }

    const userData = userDoc.data();
    const adminData = adminDoc.data();

    
    if (userData.approvedby && userData.approvedby.includes(adminId)) {
      return res.status(400).send({ message: 'Admin has already approved this user.' });
    }

    await userRef.update({ downs: userData.downs + 1 });
    await userRef.update({ approvedby: adminData.approvedby ? [...adminData.approvedby, adminId] : [adminId] });

    await adminRef.update({ approvedby: adminData.approvedby ? [...adminData.approvedby, userId] : [userId] });

    return res.status(200).send({ message: 'Downvoted successfully.' });
  } catch (error) {
    console.error('Error during downvote:', error);
    return res.status(500).send({ message: 'Server error during downvote.' });
  }
});

app.post('/api/bookmark', async (req, res) => {
  const { adminId, userId } = req.body;

  try {
    const userRef = db.collection('users').doc(userId);
    const adminRef = db.collection('users').doc(adminId);

    const userDoc = await userRef.get();
    const adminDoc = await adminRef.get();

    if (!userDoc.exists || !adminDoc.exists) {
      return res.status(404).send({ message: 'User or Admin not found.' });
    }

    const userData = userDoc.data();
    const adminData = adminDoc.data();

    let message = '';
    if (userData.submissions.includes(userId)) {
      await adminRef.update({
        submissions: adminData.submissions.filter((subId) => subId !== userId),
      });
      message = 'Unbookmarked successfully';
    } else {
      await adminRef.update({
        submissions: [...adminData.submissions, userId],
      });
      message = 'Bookmarked successfully';
    }

    return res.status(200).send({ message });
  } catch (error) {
    console.error('Error during bookmark operation:', error);
    return res.status(500).send({ message: 'Server error during bookmark operation.' });
  }
});

app.post('/api/blacklist', async (req, res) => {
  const { adminId, userId } = req.body;

  try {
    const userRef = db.collection('users').doc(userId);

    const userDoc = await userRef.get();

    if (!userDoc.exists) {
      return res.status(404).send({ message: 'User not found.' });
    }

    const userData = userDoc.data();

    if (userData.isblacklisted === 'yes') {
      return res.status(400).send({ message: 'User is already blacklisted.' });
    }

    await userRef.update({ isblacklisted: 'yes' });

    return res.status(200).send({ message: 'User blacklisted successfully.' });
  } catch (error) {
    console.error('Error during blacklist operation:', error);
    return res.status(500).send({ message: 'Server error during blacklist operation.' });
  }
});

app.post('/leaderboard', async (req, res) => {
  try {
    const { domain } = req.body;
    const adminDomain = domain;

    if (!adminDomain) {
      return res.status(400).json({ error: 'Domain is required' });
    }

    const usersSnapshot = await db.collection('users').get();
    console.log("Fetched users snapshot:", usersSnapshot.docs.length);  

    let leaderboard = usersSnapshot.docs
      .map(doc => doc.data())
      .filter(user => {
        return (  
          !user.email.includes('admin') &&  
          user.domain === adminDomain &&  
          !user.blacklisted  
        );
      })
      .map(user => ({
        name: user.name,
        ups: user.ups || 0, 
        downs: user.downs || 0,  
        net: (user.ups || 0) - (user.downs || 0), 
      }));

    leaderboard = leaderboard.map((user, index) => {
      const doc = usersSnapshot.docs[index];
      return {
        ...user,
        id: doc.id,  
      };
    });


    leaderboard.sort((a, b) => b.net - a.net);

    return res.json(leaderboard);
  } catch (error) {
    console.error('Error fetching leaderboard:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});


app.get('/api/bookmarked/:adminId', async (req, res) => {
  const { adminId } = req.params;

  try {
    const adminDoc = await db.collection('users').doc(adminId).get();
    if (!adminDoc.exists) {
      return res.status(404).send({ message: 'Admin not found.' });
    }

    const adminData = adminDoc.data();
    const submissionIds = adminData.submissions || [];

    if (submissionIds.length === 0) {
      return res.status(200).send([]); 
    }

    const users = [];
    for (const userId of submissionIds) {
      const userDoc = await db.collection('users').doc(userId).get();
      if (userDoc.exists) {
        const userData = { id: userDoc.id, name: userDoc.data().name };
        users.push(userData);
      }
    }

    res.status(200).send(users);
  } catch (error) {
    console.error('Error fetching bookmarked users:', error);
    res.status(500).send({ error: 'Failed to fetch bookmarked users.' });
  }
});

app.delete('/api/delete-bookmark/:adminId/:userId', async (req, res) => {
  const { adminId, userId } = req.params;

  try {
    const adminRef = db.collection('users').doc(adminId);
    const adminDoc = await adminRef.get();

    if (!adminDoc.exists) {
      return res.status(404).send({ message: 'Admin not found.' });
    }

    const adminData = adminDoc.data();
    const updatedSubmissions = (adminData.submissions || []).filter((id) => id !== userId);

    await adminRef.update({ submissions: updatedSubmissions });

    res.status(200).send({ message: 'Bookmark deleted successfully.' });
  } catch (error) {
    console.error('Error deleting bookmark:', error);
    res.status(500).send({ error: 'Failed to delete bookmark.' });
  }
});


app.get('/api/users/:domain', async (req, res) => {
  const { domain } = req.params;
  console.log(domain)

  if (!domain) {
    return res.status(400).json({ error: 'Domain is required' });
  }

  try {
    const usersSnapshot = await db.collection('users').where('domain', '==', domain).get();
    const users = [];
    usersSnapshot.forEach(doc => {
      const userData = doc.data();
      if (!userData.email.includes('admin')) {
        users.push({ id: doc.id, ...userData });
      }
    });


    console.log(users)
    res.json(users);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ error: 'Server error' });
  }
});



exports.app = onRequest(app);
