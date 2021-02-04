let rooms = {};
let connection;
let isSender = true;
let db;
let currentRoomId;
let localStream, remoteStream;
const configuration = {
  iceServers: [
    {
      urls: "stun:numb.viagenie.ca",
      username: "adityanaag91@gmail.com",
      credential: "aditya@123"
    },
    {
      urls: "turn:numb.viagenie.ca",
      username: "adityanaag91@gmail.com",
      credential: "aditya@123"
    }
  ]
};
/**
 create connection for both client and server
 
 */
const createConnection = () => {
  connection = new RTCPeerConnection(configuration)
  connection.ontrack = event => {
    event.streams[0].getTracks().forEach(track => {
      remoteStream.addTrack(track);
    });
  }
  connection.onicecandidate = async e =>  {
    console.log(" NEW ice candidate!! " );
    if (currentRoomId && e.candidate) {
      const roomRef = db.collection('rooms').doc(`${currentRoomId}`);
      let roomWithCandidate;
      if (isSender) {
        roomWithCandidate = {
          senderCandidate: e.candidate.toJSON()
        }
      }
      else {
        roomWithCandidate = {
          recieverCandidate: e.candidate.toJSON()
        }
      }
      
      await roomRef.update(roomWithCandidate);
      console.log('send candidate to peer');
    }
  }
  connection.onicecandidateerror = (e) => {console.log(e.errorText)}
}

const openUserMedia = async () => {
  const stream = await navigator.mediaDevices.getUserMedia(
    {video: true, audio: true});
  document.querySelector('#localVideo').srcObject = stream;
  localStream = stream;
  remoteStream = new MediaStream();
  document.querySelector('#remoteVideo').srcObject = remoteStream;
  localStream.getTracks().forEach(track => {
    console.log('adding track in connection');
    connection.addTrack(track, localStream);
  });
}

const createChannel = async () => {
  await openUserMedia();
  const sendChannel = connection.createDataChannel("sendChannel");
  sendChannel.onmessage = e => {
    const node = document.createElement('div');
    node.append(e.data);
    document.getElementById('msgBody').appendChild(node);
  };
  sendChannel.onopen = e => console.log("open!!!!");
  sendChannel.onclose =e => {
    console.log("closed!!!!!!")
    // todo delete room not working fix it
    
    currentRoomId && db.collection('rooms').doc(currentRoomId).delete().then(function() {
      console.log("room successfully deleted!");
    }).catch(function(error) {
        console.error("Error removing document: ", error);
    });
  };
  const offer = await connection.createOffer();
  const roomRef = await db.collection('rooms').add({
    offer: {
      type: offer.type,
      sdp: offer.sdp
    }
  });
  connection.setLocalDescription(offer)
  console.log('step 1: offer created and updated');

  const roomId = roomRef.id;
  currentRoomId = roomId;
  document.getElementById('link').innerText = window.location.href + `?roomId=${roomId}`;
  rooms = {
    [roomId]: sendChannel
  };
  roomRef.onSnapshot(async snapshot => {
    const data = snapshot.data();
    if (!connection.currentRemoteDescription && data && data.answer) {
        const answer = new RTCSessionDescription(data.answer);
        await connection.setRemoteDescription(answer);
        console.log('Step 3: Got the answer and set the answer');
    }
    if ( data && data.recieverCandidate) {
      const candidate = new RTCIceCandidate(data.recieverCandidate);
      await connection.addIceCandidate(candidate);
      console.log('recieve candidate and added');
    }
  });
}

const joinChannel =  async () => {
  isSender = false;
  await openUserMedia();
  connection.ondatachannel = e => {
    const receiveChannel = e.channel;
    receiveChannel.onmessage =e => {
      const node = document.createElement('div');
      node.append(e.data);
      document.getElementById('msgBody').appendChild(node);
    };
    receiveChannel.onopen = e => console.log("open!!!!");
    receiveChannel.onclose =e => console.log("closed!!!!!!");
    connection.channel = receiveChannel;

  }
  const roomId = window.location.search.split('=')[1];
  currentRoomId = roomId;
  const roomRef = db.collection('rooms').doc(`${roomId}`);
  const roomSnapshot = await roomRef.get();
  if (roomSnapshot.exists) {
    const offer = roomSnapshot.data().offer;
    const remoteOffer = new RTCSessionDescription(offer);
    await connection.setRemoteDescription(remoteOffer);
    const answer = await connection.createAnswer()
    await connection.setLocalDescription(answer);
    console.log('step 2: set offer created answer and updated answer');
    const roomWithAnswer = {
        answer: {
            type: answer.type,
            sdp: answer.sdp
        }
    }
    await roomRef.update(roomWithAnswer);
  }
  roomRef.onSnapshot(async snapshot => {
    const data = snapshot.data();
    if (data && data.senderCandidate) {
      const candidate = new RTCIceCandidate(data.senderCandidate);
      await connection.addIceCandidate(candidate);
      console.log('recieve candidate and added');
    }
  });
}


const sendMessage = () => {
  const msg = document.getElementById('sendMessage').value;
  const node = document.createElement('div');
  node.style.textAlign = 'right';
  node.append(msg);
  document.getElementById('msgBody').appendChild(node);
  if (isSender) {
    rooms[currentRoomId].send(msg);
  }
  else {
    connection.channel.send(msg);
  }
}

const initDbConnection = () => {
  var firebaseConfig = {
    apiKey: "AIzaSyDdzhAHhMQeAo4egpTbj3K-JiuV_InAFkU",
    authDomain: "fir-rtc-8e4b2.firebaseapp.com",
    databaseURL: "https://fir-rtc-8e4b2.firebaseio.com",
    projectId: "fir-rtc-8e4b2",
    storageBucket: "fir-rtc-8e4b2.appspot.com",
    messagingSenderId: "159303557727",
    appId: "1:159303557727:web:2ae59edac452b77736b1ea",
    measurementId: "G-FWJYK5VF1B"
  };
  // Initialize Firebase
  firebase.initializeApp(firebaseConfig);
  
  db = firebase.firestore();
}

(function () {
  createConnection();
  initDbConnection();
  window.location.search.split('=')[1] && joinChannel();
})();
