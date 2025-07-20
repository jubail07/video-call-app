const socket = io();

const localVideo = document.getElementById('localVideo')
const nameInputWrapper = document.querySelector('.name-input-wrapper')
const nameInput = document.querySelector('.name-input')
const startMeeting = document.querySelector('.start-meeting')
const closeBtn = document.querySelector('.close-btn')
const joinInput = document.querySelector('.join-input')
const joinBtn = document.querySelector('.join')
const meetingIdDisplay = document.getElementById('meeting-id')
const chatForm = document.getElementById('chatForm')
const input = document.querySelector('.cust-input')
const messageArea = document.getElementById('message')

let peerConnections = {}
let localStream
var roomId
let username = ''

const servers = {
    iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
};

async function startCamera() {
    localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true })
    const audioTrack = localStream.getAudioTracks()[0];
    if (audioTrack) {
        audioTrack.enabled = false; // mic muted
        // micMute.innerHTML = '<i class="bi bi-mic-mute"></i>';
    }
    localVideo.srcObject = localStream;
}

function stopCamera() {
    if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
        localStream = null
    }
    navigator.mediaDevices.enumerateDevices().then(devices => {
        const videoInputs = devices.filter(device => device.kind === 'videoinput');
        console.log('Available video devices after stop:', videoInputs);
    })
    location.reload()
}

startMeeting.onclick = async () => {
    try {
        const name = nameInput.value.trim();
        if (!name) return alert("Please enter your name");

        username = name;
        roomId = Math.random().toString(36).substring(2, 8);
        console.log('Room ID:', roomId);

        await startCamera();
        meetingIdDisplay.textContent = `Meeting ID: ${roomId}`;
        joinRoom(roomId);

        document.getElementById('hangupBtn').style.display = 'block';
        document.querySelector('.meeting-container').style.display = 'flex';
        document.getElementById('nameDisplay').innerText = name;
    } catch (error) {
        console.error('Error starting meeting:', error);
    }
};

joinBtn.onclick = async (e) => {
    e.preventDefault();
    const joinUser = document.querySelector('.join-name-input').value.trim()
    roomId = joinInput.value.trim();
    if (!roomId) return alert('Please enter a valid meeting ID');
    if (!joinUser) return alert('please enter your name')
    username = joinUser
    await startCamera()
    joinRoom(roomId)

    document.getElementById('hangupBtn').style.display = 'block';
    document.querySelector('.meeting-container').style.display = 'flex';
    document.getElementById('nameDisplay').innerText = joinUser
};

function joinRoom(room) {
    socket.emit('join', room);
}

function createPeerConnection(userId) {
    const pc = new RTCPeerConnection(servers);
    peerConnections[userId] = pc;

    pc.onicecandidate = (event) => {
        if (event.candidate) {
            socket.emit('ice-candidate', {
                to: userId,
                from: socket.id,
                candidate: event.candidate
            });
        }
    };

    pc.ontrack = (event) => {
        let video = document.getElementById(userId);
        if (!video) {
            video = document.createElement('video');
            video.id = userId;
            video.autoplay = true;
            video.playsInline = true;
            video.srcObject = event.streams[0];
            document.getElementById('participantGrid').appendChild(video);
        }
    };

    return pc;
}

socket.on('invalid-room', () => {
    alert('Invalid Meeting ID. Please check and try again.');
});

socket.on('all-users', async (users) => {
    for (let userId of users) {
        const pc = createPeerConnection(userId);
        localStream.getTracks().forEach(track => pc.addTrack(track, localStream));

        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);

        socket.emit('offer', {
            to: userId,
            from: socket.id,
            offer: pc.localDescription
        });
    }
});

socket.on('offer', async ({ from, offer }) => {
    const pc = createPeerConnection(from);
    localStream.getTracks().forEach(track => pc.addTrack(track, localStream));

    await pc.setRemoteDescription(new RTCSessionDescription(offer));
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);

    socket.emit('answer', {
        to: from,
        from: socket.id,
        answer: pc.localDescription
    });
});

socket.on('answer', async ({ from, answer }) => {
    const pc = peerConnections[from];
    if (pc) {
        await pc.setRemoteDescription(new RTCSessionDescription(answer));
    }
});

socket.on('ice-candidate', async ({ from, candidate }) => {
    const pc = peerConnections[from];
    if (pc && candidate) {
        try {
            await pc.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (error) {
            console.error('Error adding received ICE candidate', error);
        }
    }
});

socket.on('user-left', (id) => {
    const pc = peerConnections[id];
    if (pc) {
        pc.close();
        delete peerConnections[id];
    }
    const video = document.getElementById(id);
    if (video) {
        video.remove();
    }
})

const hangupBtn = document.getElementById('hangupBtn');

hangupBtn.onclick = () => {
    for (let id in peerConnections) {
        peerConnections[id].close();
        delete peerConnections[id];
        const video = document.getElementById(id);
        if (video) video.remove();
    }
    stopCamera()

    socket.emit('leave', { room: roomId, id: socket.id });
    meetingIdDisplay.textContent = '';
    hangupBtn.style.display = 'none';
    document.querySelector('.meeting-container').style.display = 'none'
    nameInputWrapper.style.display = 'none'
    document.querySelector('.chatForm').style.display = 'none'
    // window.reload()
}

const videoClose = document.getElementById('videoClose')
let cameraOn = true

videoClose.onclick = () => {
    if (!localStream) return

    const videoTrack = localStream.getVideoTracks()[0];
    if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        videoClose.innerHTML = videoTrack.enabled ? '<i class="bi bi-camera-video-off"></i>' : '<i class="bi bi-camera-video"></i>';
    }
}

const micMute = document.getElementById('mute')

micMute.onclick = () => {
    if (!localStream) return;

    const audioTrack = localStream.getAudioTracks()[0]
    if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled
        micMute.innerHTML = audioTrack.enabled
            ? '<i class="bi bi-mic"></i>'
            : '<i class="bi bi-mic-mute"></i>'
    }
}

const screenShareBtn = document.getElementById('screenShareBtn');
let isScreenSharing = false;
let screenStream;

screenShareBtn.onclick = async () => {
    if (!isScreenSharing) {
        try {
            screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
            const screenTrack = screenStream.getVideoTracks()[0];
            // Replace video track in each peer connection
            for (let id in peerConnections) {
                const sender = peerConnections[id]
                    .getSenders()
                    .find(s => s.track.kind === 'video');
                if (sender) sender.replaceTrack(screenTrack);
            }
            // Replace local video feed
            localVideo.srcObject = screenStream;

            // When user stops screen share manually
            screenTrack.onended = () => {
                stopScreenSharing();
            };

            isScreenSharing = true;
            screenShareBtn.innerHTML = '<i class="bi bi-cast">';
        } catch (err) {
            console.error('Error sharing screen:', err);
        }
    } else {
        stopScreenSharing();
    }
};

function stopScreenSharing() {
    if (!screenStream) return;

    const videoTrack = localStream.getVideoTracks()[0];

    for (let id in peerConnections) {
        const sender = peerConnections[id]
            .getSenders()
            .find(s => s.track.kind === 'video');
        if (sender) sender.replaceTrack(videoTrack);
    }

    localVideo.srcObject = localStream;
    screenStream.getTracks().forEach(track => track.stop());
    isScreenSharing = false;
    screenShareBtn.innerHTML = '<i class="bi bi-cast">';
}

const toggleChatBtn = document.getElementById('toggleChatBtn');

toggleChatBtn.onclick = () => {
    const chatBox = document.querySelector('.chat-box')
    const isHidden = chatBox.classList.contains('d-none');
    chatBox.classList.toggle('d-none');
    toggleChatBtn.innerHTML = isHidden ? '<i class="bi bi-chat-left"></i>' : '<i class="bi bi-chat-left-text"></i>';
};

chatForm.addEventListener('submit', (i) => {
    i.preventDefault()
    const msgText = input.value.trim()
    if (msgText) {
        socket.emit('chat', {
            user: username,
            text: msgText
        })
        input.value = ''
    }
})

socket.on('chat', (msg) => {
    const p = document.createElement('p')
    p.innerHTML = `<strong>${msg.user}:</strong> ${msg.text}`
    messageArea.appendChild(p)
    messageArea.scrollTop = messageArea.scrollHeight
})

