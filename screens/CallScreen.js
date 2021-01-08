import React, {useEffect, useState, useCallback, useRef} from 'react';
import {View, StyleSheet, Alert} from 'react-native';
import {Text} from 'react-native-paper';
import {Button} from 'react-native-paper';
import AsyncStorage from '@react-native-community/async-storage';
import {TextInput} from 'react-native-paper';

import {useFocusEffect} from '@react-navigation/native';

import InCallManager from 'react-native-incall-manager';
import Modal from 'react-native-modal';

import {
  RTCPeerConnection,
  RTCIceCandidate,
  RTCSessionDescription,
  RTCView,
  MediaStream,
  MediaStreamTrack,
  mediaDevices,
  registerGlobals,
} from 'react-native-webrtc';

const STUN_SERVER = 'stun:webrtc.skyrockets.space:3478';
const SOCKET_URL = 'wss://webrtc.skyrockets.space:8080';

export default function CallScreen({navigation, ...props}) {
  const [userId, setUserId] = useState('');
  const [socketActive, setSocketActive] = useState(false);
  const [calling, setCalling] = useState(false);
  const [localStream, setLocalStream] = useState({toURL: () => null});
  const [remoteStream, setRemoteStream] = useState({toURL: () => null});

  const conn = useRef(new WebSocket(SOCKET_URL));

  const yourConn = useRef(
    new RTCPeerConnection({
      iceServers: [
        {
          urls: STUN_SERVER,
        },
      ],
    }),
  );

  const [callActive, setCallActive] = useState(false);
  const [incomingCall, setIncomingCall] = useState(false);
  const [otherId, setOtherId] = useState('');
  const [callToUsername, setCallToUsername] = useState(null);
  const connectedUser = useRef(null);
  const offerRef = useRef(null);

  useFocusEffect(
    useCallback(() => {
      AsyncStorage.getItem('userId').then(id => {
        console.log(id);
        if (id) {
          setUserId(id);
        } else {
          setUserId('');
          navigation.push('Login');
        }
      });
    }, [userId]),
  );

  useEffect(() => {
    navigation.setOptions({
      title: 'Your ID - ' + userId,
      headerRight: () => (
        <Button mode="text" onPress={onLogout} style={{paddingRight: 10}}>
          Logout
        </Button>
      ),
    });
  }, [userId]);

  /**
   * Calling Stuff
   */

  useEffect(() => {
    if (socketActive && userId.length > 0) {
      try {
        // InCallManager.start({media: 'audio'});
        // InCallManager.setForceSpeakerphoneOn(true);
        // InCallManager.setSpeakerphoneOn(true);
      } catch (err) {
        console.log('InApp Caller ---------------------->', err);
      }

      send({
        type: 'login',
        name: userId,
      });
    }
  }, [socketActive, userId]);

  const onLogin = () => {};

  useEffect(() => {
    /**
     *
     * Sockets Signalling
     */
    conn.current.onopen = () => {
      console.log('Connected to the signaling server');
      setSocketActive(true);
    };
    //when we got a message from a signaling server
    conn.current.onmessage = msg => {
      const data = JSON.parse(msg.data);
      // console.log('Data --------------------->', data);
      switch (data.type) {
        case 'login':
          console.log('Login');
          break;
        //when somebody wants to call us
        case 'offer':
          handleOffer(data.offer, data.name);
          console.log('Offer');
          break;
        case 'answer':
          handleAnswer(data.answer);
          console.log('Answer');
          break;
        //when a remote peer sends an ice candidate to us
        case 'candidate':
          handleCandidate(data.candidate);
          console.log('Candidate');
          break;
        case 'leave':
          handleLeave();
          console.log('Leave');
          break;
        default:
          break;
      }
    };
    conn.current.onerror = function(err) {
      console.log('Got error', err);
    };
    initLocalVideo();
    registerPeerEvents();
  }, []);

  useEffect(() => {
    if (!callActive) {
      // InCallManager.stop();
    } else {
      // InCallManager.setSpeakerphoneOn(true);
    }
  }, [callActive]);

  const registerPeerEvents = () => {
    yourConn.current.onaddstream = event => {
      console.log('On Add Remote Stream');
      setRemoteStream(event.stream);
    };

    // Setup ice handling
    yourConn.current.onicecandidate = event => {
      if (event.candidate) {
        send({
          type: 'candidate',
          candidate: event.candidate,
        });
      }
    };
  };

  const initLocalVideo = () => {
    // let isFront = false;
    // mediaDevices.enumerateDevices().then(sourceInfos => {
    //   let videoSourceId;
    //   for (let i = 0; i < sourceInfos.length; i++) {
    //     const sourceInfo = sourceInfos[i];
    //     if (
    //       sourceInfo.kind == 'videoinput' &&
    //       sourceInfo.facing == (isFront ? 'front' : 'environment')
    //     ) {
    //       videoSourceId = sourceInfo.deviceId;
    //     }
    //   }
    mediaDevices
      .getUserMedia({
        audio: true,
        video: {
          mandatory: {
            minWidth: 500, // Provide your own width, height and frame rate here
            minHeight: 300,
            minFrameRate: 30,
          },
          facingMode: 'user',
          // optional: videoSourceId ? [{sourceId: videoSourceId}] : [],
        },
      })
      .then(stream => {
        // Got stream!
        setLocalStream(stream);

        // setup stream listening
        yourConn.current.addStream(stream);
      })
      .catch(error => {
        // Log error
      });
    // });
  };

  const send = message => {
    //attach the other peer username to our messages
    if (connectedUser.current) {
      message.name = connectedUser.current;
      // console.log('Connected iser in end----------', message);
    }
    conn.current.send(JSON.stringify(message));
  };

  const onCall = () => {
    setCalling(true);
    connectedUser.current = callToUsername;
    console.log('Caling to', callToUsername);
    // create an offer

    yourConn.current.createOffer().then(offer => {
      yourConn.current.setLocalDescription(offer).then(() => {
        console.log('Sending Ofer');
        // console.log(offer);
        send({
          type: 'offer',
          offer: offer,
        });
        // Send pc.localDescription to peer
      });
    });
  };

  //when somebody sends us an offer
  const handleOffer = async (offer, name) => {
    console.log(name + ' is calling you.');
    connectedUser.current = name;
    offerRef.current = {name, offer};
    setIncomingCall(true);
    setOtherId(name);
    // acceptCall();
  };

  const acceptCall = async () => {
    const name = offerRef.current.name;
    const offer = offerRef.current.offer;
    setIncomingCall(false);
    setCallActive(true);
    console.log('Accepting CALL', name, offer);
    yourConn.current
      .setRemoteDescription(offer)
      .then(function() {
        connectedUser.current = name;
        return yourConn.current.createAnswer();
      })
      .then(function(answer) {
        yourConn.current.setLocalDescription(answer);
        send({
          type: 'answer',
          answer: answer,
        });
      })
      .then(function() {
        // Send the answer to the remote peer using the signaling server
      })
      .catch(err => {
        console.log('Error acessing camera', err);
      });

    // try {
    //   await yourConn.setRemoteDescription(new RTCSessionDescription(offer));

    //   const answer = await yourConn.createAnswer();

    //   await yourConn.setLocalDescription(answer);
    //   send({
    //     type: 'answer',
    //     answer: answer,
    //   });
    // } catch (err) {
    //   console.log('Offerr Error', err);
    // }
  };

  //when we got an answer from a remote user
  const handleAnswer = answer => {
    setCalling(false);
    setCallActive(true);
    yourConn.current.setRemoteDescription(new RTCSessionDescription(answer));
  };

  //when we got an ice candidate from a remote user
  const handleCandidate = candidate => {
    setCalling(false);
    // console.log('Candidate ----------------->', candidate);
    yourConn.current.addIceCandidate(new RTCIceCandidate(candidate));
  };

  //hang up
  // const hangUp = () => {
  //   send({
  //     type: 'leave',
  //   });

  //   handleLeave();
  // };

  // const handleLeave = () => {
  //   connectedUser.current = null;
  //   setRemoteStream({toURL: () => null});

  //   // yourConn.close();
  //   // yourConn.onicecandidate = null;
  //   // yourConn.onaddstream = null;
  // };

  const onLogout = () => {
    // hangUp();

    handleLeave();

    AsyncStorage.removeItem('userId').then(res => {
      navigation.push('Login');
    });
  };

  const rejectCall = async () => {
    send({
      type: 'leave',
    });
    // ``;
    // setOffer(null);

    // handleLeave();
  };

  const handleLeave = () => {
    send({
      name: userId,
      otherName: otherId,
      type: 'leave',
    });

    setCalling(false);
    setIncomingCall(false);
    setCallActive(false);
    offerRef.current = null;
    connectedUser.current = null;
    setRemoteStream(null);
    setLocalStream(null);
    yourConn.current.onicecandidate = null;
    yourConn.current.ontrack = null;

    resetPeer();
    initLocalVideo();
    // console.log("Onleave");
  };

  const resetPeer = () => {
    yourConn.current = new RTCPeerConnection({
      iceServers: [
        {
          urls: STUN_SERVER,
        },
      ],
    });

    registerPeerEvents();
  };

  /**
   * Calling Stuff Ends
   */

  return (
    <View style={styles.root}>
      <View style={styles.inputField}>
        <TextInput
          label="Enter Friends Id"
          mode="outlined"
          style={{marginBottom: 7}}
          onChangeText={text => setCallToUsername(text)}
        />
        <Button
          mode="contained"
          onPress={onCall}
          loading={calling}
          //   style={styles.btn}
          contentStyle={styles.btnContent}
          disabled={!(socketActive && userId.length > 0)}>
          Call
        </Button>
        <Button
          mode="contained"
          onPress={handleLeave}
          contentStyle={styles.btnContent}
          disabled={!callActive}>
          End Call
        </Button>
      </View>

      <View style={styles.videoContainer}>
        <View style={[styles.videos, styles.localVideos]}>
          <Text>Your Video</Text>
          <RTCView
            streamURL={localStream ? localStream.toURL() : ''}
            style={styles.localVideo}
          />
        </View>
        <View style={[styles.videos, styles.remoteVideos]}>
          <Text>Friends Video</Text>
          <RTCView
            streamURL={remoteStream ? remoteStream.toURL() : ''}
            style={styles.remoteVideo}
          />
        </View>
      </View>

      <Modal isVisible={incomingCall}>
        <View
          style={{
            backgroundColor: 'white',
            padding: 22,
            justifyContent: 'center',
            alignItems: 'center',
            borderRadius: 4,
            borderColor: 'rgba(0, 0, 0, 0.1)',
          }}>
          <Text>{otherId + ' is calling you'}</Text>

          <Button onPress={acceptCall}>Accept Call</Button>
          <Button title="Reject Call" onPress={handleLeave}>
            Reject Call
          </Button>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    backgroundColor: '#fff',
    flex: 1,
    padding: 20,
  },
  inputField: {
    marginBottom: 10,
    flexDirection: 'column',
  },
  videoContainer: {
    flex: 1,
    minHeight: 450,
  },
  videos: {
    width: '100%',
    flex: 1,
    position: 'relative',
    overflow: 'hidden',

    borderRadius: 6,
  },
  localVideos: {
    height: 100,
    marginBottom: 10,
  },
  remoteVideos: {
    height: 400,
  },
  localVideo: {
    backgroundColor: '#f2f2f2',
    height: '100%',
    width: '100%',
  },
  remoteVideo: {
    backgroundColor: '#f2f2f2',
    height: '100%',
    width: '100%',
  },
});
