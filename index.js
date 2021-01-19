let rooms = {};
let connection;
let isSender = true;
let db;
let currentRoomId;
const createConnection = () => {
  connection = new RTCPeerConnection()
  connection.onicecandidate = e =>  {
    console.log(" NEW ice candidnat!! on localconnection reprinting SDP " )
    // console.log(JSON.stringify(connection.localDescription))
  }
}

const createChannel = async () => {
  const sendChannel = connection.createDataChannel("sendChannel");
  sendChannel.onmessage =e => {
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
  connection.setLocalDescription(offer)
  const roomRef = await db.collection('rooms').add({
    offer: {
      type: offer.type,
      sdp: offer.sdp
    }
  });
  const roomId = roomRef.id;
  currentRoomId = roomId;
  console.log('room id ', roomId )
  rooms = {
    [roomId]: sendChannel
  };
  roomRef.onSnapshot(async snapshot => {
    console.log('Got updated room:', snapshot.data());
    const data = snapshot.data();
    if (!connection.currentRemoteDescription && data.answer) {
        const answer = new RTCSessionDescription(data.answer)
        await connection.setRemoteDescription(answer);
        console.log('done!!!')
    }
  });
}

const joinChannel =  async () => {
  isSender = false;
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
  const roomId = window.prompt('roomId?');
  const roomRef = db.collection('rooms').doc(`${roomId}`);
  const roomSnapshot = await roomRef.get();
  if (roomSnapshot.exists) {
    const offer = roomSnapshot.data().offer;
    await connection.setRemoteDescription(offer);
    const answer = await connection.createAnswer()
    await connection.setLocalDescription(answer);

    const roomWithAnswer = {
        answer: {
            type: answer.type,
            sdp: answer.sdp
        }
    }
    await roomRef.update(roomWithAnswer);
  }
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
  initDbConnection()
})();