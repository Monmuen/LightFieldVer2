
import * as THREENEW from './vendor/three.js';
import * as THREE from './vendor/three.module.js';
import { OrbitControls } from './vendor/OrbitControls.js';
import { StereoEffect } from './vendor/StereoEffects.js';
import { VRButton } from './vendor/VRButton.js';
import ThreeMeshUI from 'https://cdn.skypack.dev/three-mesh-ui';
import { XRControllerModelFactory } from './vendor/XRControllerModelFactory.js';

const controllerModelFactory = new XRControllerModelFactory();

let isVRPresenting = false;
const apertureInput = document.querySelector('#aperture');
const focusInput = document.querySelector('#focus');
const stInput = document.querySelector('#stplane');
const loadWrap = document.querySelector('#load-wrap');
const gyroButton = document.querySelector('#gyro-button');
const controlsDiv = document.querySelector('.controls');
const progressContainer = document.querySelector('#progress-container');
const backButton = document.querySelector('#back-button');
const resetButton = document.querySelector('#reset-button')

const amethystButton = document.querySelector('#amethyst');
const legoKnightsButton = document.querySelector('#legoKnights');
const legoTruckButton = document.querySelector('#legoTruck');
const theStanfordBunnyButton = document.querySelector('#theStanfordBunny');
const tarotCardsAndCrystalBallButton = document.querySelector('#tarotCardsAndCrystalBall');

const scene = new THREE.Scene();
let width = window.innerWidth;
let height = window.innerHeight;
const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
const gyroCamera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
const renderer = new THREE.WebGLRenderer({ antialias: true });
let fragmentShader, vertexShader;
renderer.xr.enabled = true;
renderer.setSize(width, height);
document.body.appendChild(renderer.domElement);
document.body.appendChild(VRButton.createButton(renderer));

camera.position.z = 2;
gyroCamera.position.z = 2;
gyroCamera.lookAt(0, 0, 1);

const effect = new StereoEffect(renderer);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.target = new THREE.Vector3(0, 0, 1);
controls.panSpeed = 2;
controls.enabled = true; 

let useDeviceControls = false;
let fieldTexture;
let plane, planeMat, planePts;
const camsX = 17;
const camsY = 17;
const cameraGap = 0.08;
let aperture = Number(apertureInput.value);
let focus = Number(focusInput.value);
let isStereoView = true;
const vConsole = new VConsole();

let resX;
let resY;
window.addEventListener('resize', () => {
  if (!isVRPresenting) {
  width = window.innerWidth;
  height = window.innerHeight;
  camera.aspect = width / height;
  gyroCamera.aspect = width / height;
  camera.updateProjectionMatrix();
  gyroCamera.updateProjectionMatrix();
  renderer.setSize(width, height);
  effect.setSize(width, height);
  }
});

apertureInput.addEventListener('input', e => {
  aperture = Number(apertureInput.value);
  planeMat.uniforms.aperture.value = aperture;
});

focusInput.addEventListener('input', e => {
  focus = Number(focusInput.value);
  planeMat.uniforms.focus.value = focus;
});

stInput.addEventListener('input', () => {
  planePts.visible = stInput.checked;
});

gyroButton.addEventListener('click', () => {
  useDeviceControls = !useDeviceControls;
  if (useDeviceControls) {
    if (DeviceMotionEvent.requestPermission) {
      requestPermission();
      }
    controls.enabled = false;
    initDeviceOrientationControls();
    console.log("Start the device control mode.");
    }else {
    controls.enabled = true;
    disableDeviceOrientationControls();
    console.log("Close the device control mode.");
  }
});

function requestPermission() {
  DeviceMotionEvent.requestPermission()
    .then(function (permissionState) {
    // granted:用户允许浏览器监听陀螺仪事件
    if (permissionState === 'granted') {
      rotate()
    } else {
      gyroButton.innerHTML = 'Please grant the permission.'
    }
  }).catch(function (err) {s
    gyroButton.innerHTML = 'Permisstion request failed.'
  });
}

backButton.addEventListener('click', () => {
  loadWrap.style.display = 'flex'; // Show load wrap
  controlsDiv.style.display = 'none'; // Hide controls
  progressContainer.style.display = 'none'; 
  scene.remove(plane); // Remove the plane from the scene
  scene.remove(planePts);
  if (planeMat) {
    planeMat.dispose(); // Dispose of the plane material
  }
  if (fieldTexture) {
    fieldTexture.dispose(); // Dispose of the field texture
  }
  console.log('Returned to main menu.');
});

resetButton.addEventListener('click', () => {
  if(useDeviceControls){
    gyroCamera.position.set(0,0,2);
    gyroCamera.lookAt(0, 0, 1);
  }
  else{
    camera.position.set(0,0,2);
    controls.target = new THREE.Vector3(0, 0, 1);
  }
  console.log('Reset the position.');
});


// 为每个按钮添加事件监听器
amethystButton.addEventListener('click', () => loadLightField('Amethyst', 384, 512));
legoKnightsButton.addEventListener('click', () => loadLightField('LegoKnights', 512, 512));
legoTruckButton.addEventListener('click', () => loadLightField('LegoTruck', 640, 480));
theStanfordBunnyButton.addEventListener('click', () => loadLightField('TheStanfordBunny', 512, 512));
tarotCardsAndCrystalBallButton.addEventListener('click', () => loadLightField('TarotCardsAndCrystalBall', 512, 512));

async function loadLightField(sceneName, resolutionX, resolutionY) {
  resX = resolutionX;
  resY = resolutionY;

  controlsDiv.style.display = 'none'; // Hide controls
  progressContainer.style.display = 'block'; // Show progress
  await loadShaders();
  initPlaneMaterial();
  await extractVideo(sceneName);
  loadPlane();
  console.log('Plane Geometry:', plane.geometry);
  console.log('Plane Material:', plane.material);
  animate();
}

async function loadShaders() {
  const [vertexShaderRes, fragmentShaderRes] = await Promise.all([
    fetch('./vertex.glsl'),
    fetch('./fragment.glsl')
  ]);
  vertexShader = await vertexShaderRes.text();
  fragmentShader = await fragmentShaderRes.text();
}
function initPlaneMaterial() {
  planeMat = new THREE.ShaderMaterial({
    uniforms: {
      field: { value: null },
      camArraySize: new THREE.Uniform(new THREE.Vector2(camsX, camsY)),
      aperture: { value: aperture },
      focus: { value: focus },
     // imageAspect: { value: new THREE.Vector2(resX / resY, 1.0) }
      imageAspect: { value: resX / resY }
    },
    vertexShader,
    fragmentShader,
  });
  console.log("res:",resX,resY);
}

function loadPlane() {
  const aspect = resX / resY;
  const planeGeo = new THREE.PlaneGeometry(camsX * cameraGap * 4 * aspect, camsY * cameraGap * 4, camsX, camsY);
  const planePtsGeo = new THREE.PlaneGeometry(camsX * cameraGap * 2 * aspect, camsY * cameraGap * 2, camsX, camsY);
  const ptsMat = new THREE.PointsMaterial({ size: 0.01, color: 0xeeccff });
  planePts = new THREE.Points(planePtsGeo, ptsMat);
  planePts.position.set(0, 0, -0.01);
  planePts.visible = stInput.checked;
  plane = new THREE.Mesh(planeGeo, planeMat);
  scene.add(planePts);
  scene.add(plane);
  console.log('Loaded plane');
}

async function extractVideo(sceneName) {
  try {
    const video = document.createElement('video');
    video.crossOrigin = 'anonymous'; // 处理跨域问题
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const progressElement = document.getElementById('progress');
    let filesrc = `https://monmuen.xyz/${sceneName}/${sceneName}1.mp4`;
    console.log(`Video source set to: ${filesrc}`);
    canvas.width = resX;
    canvas.height = resY;
    canvas.setAttribute('id', 'videosrc');
    video.src = filesrc;

    // 更详细的错误信息
    video.addEventListener('error', (e) => {
      const error = e.currentTarget.error;
      let errorMessage = 'Unknown error';
      switch (error.code) {
        case error.MEDIA_ERR_ABORTED:
          errorMessage = 'You aborted the video playback.';
          break;
        case error.MEDIA_ERR_NETWORK:
          errorMessage = 'A network error caused the video download to fail part-way.';
          break;
        case error.MEDIA_ERR_DECODE:
          errorMessage = 'The video playback was aborted due to a corruption problem or because the video used features your browser did not support.';
          break;
        case error.MEDIA_ERR_SRC_NOT_SUPPORTED:
          errorMessage = 'The video could not be loaded, either because the server or network failed or because the format is not supported.';
          break;
        default:
          errorMessage = 'An unknown error occurred.';
          break;
      }
      console.error('Error loading video:', errorMessage);
      alert(`Error loading video: ${errorMessage}`);
    });

    let seekResolve;
    let count = 0;
    let offset = 0;
    const allBuffer = new Uint8Array(resX * resY * 4 * camsX * camsY);

    const getBufferFromVideo = () => {
      ctx.drawImage(video, 0, 0, resX, resY);
      const imgData = ctx.getImageData(0, 0, resX, resY);
      allBuffer.set(imgData.data, offset);
      offset += imgData.data.byteLength;
      count++;
      progressElement.textContent = `Loaded ${Math.round(100 * count / (camsX * camsY))}%`;
    };

    const fetchFrames = async () => {
      let currentTime = 0;

      while (count < camsX * camsY) {
        getBufferFromVideo();
        currentTime += 0.0333;
        video.currentTime = currentTime;
        await new Promise(res => (seekResolve = res));
      }

      loadWrap.style.display = 'none';

      fieldTexture = new THREE.DataTexture2DArray(allBuffer, resX, resY, camsX * camsY);
      console.log('Loaded field data');

      planeMat.uniforms.field.value = fieldTexture;
      fieldTexture.needsUpdate = true;
    };

    video.addEventListener('seeked', async function () {
      if (seekResolve) seekResolve();
      console.log('Video seeked');
    });

    video.addEventListener('loadeddata', async () => {
      console.log('Video loadeddata event triggered');
      await fetchFrames();
      console.log('loaded data');
      controlsDiv.style.display = 'block'; // Show controls
      loadWrap.style.display = 'none'; // Hide load wrap 
    });

    // 添加更多事件监听器以捕捉所有视频加载事件
    video.addEventListener('loadstart', () => console.log('Video loadstart event triggered'));
    video.addEventListener('progress', () => console.log('Video progress event triggered'));
    video.addEventListener('suspend', () => console.log('Video suspend event triggered'));
    video.addEventListener('abort', () => console.log('Video abort event triggered'));
    video.addEventListener('emptied', () => console.log('Video emptied event triggered'));
    video.addEventListener('stalled', () => console.log('Video stalled event triggered'));
    video.addEventListener('loadedmetadata', () => console.log('Video loadedmetadata event triggered'));
    video.addEventListener('canplay', () => console.log('Video canplay event triggered'));
    video.addEventListener('canplaythrough', () => console.log('Video canplaythrough event triggered'));

    document.body.appendChild(video);
    video.load();
    console.log('Video element added to DOM and load called');

  } catch (error) {
    console.error('Error extracting video:', error);
    alert('An error occurred while extracting video.');
  }
}


function animate() {
  renderer.setAnimationLoop(() => {
    let activeCamera = useDeviceControls ? gyroCamera : camera;
    if (!useDeviceControls) {
      controls.update();
    }

    // Update ThreeMeshUI
    ThreeMeshUI.update();

    // Handle VR controller interactions
    if (renderer.xr.isPresenting) {
      controllers.forEach(controller => handleController(controller));
    }

    if (isStereoView) {
      effect.setSize(window.innerWidth, window.innerHeight);
      effect.render(scene, activeCamera);
    } else {
      renderer.setSize(width, height);
      renderer.render(scene, activeCamera);
    }
  });
}

let initialOrientation = null;

function initDeviceOrientationControls() {
  window.addEventListener('deviceorientation', handleDeviceOrientation);
}

function disableDeviceOrientationControls() {
  window.removeEventListener('deviceorientation', handleDeviceOrientation);
  initialOrientation = null;
}

function handleDeviceOrientation(event) {
  const alpha = event.alpha ? THREE.MathUtils.degToRad(event.alpha) : 0;
  const beta = event.beta ? THREE.MathUtils.degToRad(event.beta) : 0;
  const gamma = event.gamma ? THREE.MathUtils.degToRad(event.gamma) : 0;

  if (!initialOrientation) {
    initialOrientation = { alpha, beta, gamma };
  }

  updateCameraOrientation(alpha, beta, gamma);
}

function updateCameraOrientation(alpha, beta, gamma) {
  const alphaOffset = initialOrientation ? alpha - initialOrientation.alpha : 0;
  const betaOffset = initialOrientation ? beta - initialOrientation.beta : 0;
  const gammaOffset = initialOrientation ? gamma - initialOrientation.gamma : 0;

  const euler = new THREE.Euler(alphaOffset,betaOffset,-gammaOffset, 'YXZ');
  gyroCamera.quaternion.setFromEuler(euler);
  gyroCamera.updateMatrixWorld(true);
}


// VR模式UI部分

const uiContainer = new ThreeMeshUI.Block({
  justifyContent: 'center',
  contentDirection: 'row-reverse',
  fontFamily: './assets/Roboto-msdf.json',
  fontTexture: './assets/Roboto-msdf.png',
  fontSize: 0.05,
  padding: 0.02,
  borderRadius: 0.11,
  backgroundColor: new THREE.Color(0x222222),
  backgroundOpacity: 0.8
});

uiContainer.position.set(0, 1, -2);
uiContainer.rotation.x = -0.5;
uiContainer.visible = false;  // 一开始隐藏
scene.add(uiContainer);


function createButton(text, onClick) {
  const button = new ThreeMeshUI.Block({
    width: 0.3,
    height: 0.15,
    justifyContent: 'center',
    offset: 0.05,
    margin: 0.02,
    borderRadius: 0.075,
    backgroundColor: new THREE.Color(0x666666),
    backgroundOpacity: 0.3
  });

  button.onClick = onClick;  // Ensure each button has an onClick method

  button.add(new ThreeMeshUI.Text({ content: text }));

  button.setupState({
    state: 'selected',
    attributes: {
      offset: 0.02,
      backgroundColor: new THREE.Color(0x777777),
      fontColor: new THREE.Color(0x222222)
    },
    onSet: () => {
      button.onClick();  // Execute the onClick callback
    }
  });

  button.setupState({
    state: 'hovered',
    attributes: {
      offset: 0.035,
      backgroundColor: new THREE.Color(0x999999),
      fontColor: new THREE.Color(0xffffff)
    }
  });

  button.setupState({
    state: 'idle',
    attributes: {
      offset: 0.035,
      backgroundColor: new THREE.Color(0x666666),
      backgroundOpacity: 0.3,
      fontColor: new THREE.Color(0xffffff)
    }
  });

  return button;
}

// Example usage
uiContainer.add(
  createButton('+Aperture', () => {
    aperture += 0.1;
    planeMat.uniforms.aperture.value = aperture;
  }),
  createButton('-Aperture', () => {
    aperture = Math.max(0, aperture - 0.1);
    planeMat.uniforms.aperture.value = aperture;
  }),
  createButton('+Focus', () => {
    focus += 0.01;
    planeMat.uniforms.focus.value = focus;
  }),
  createButton('-Focus', () => {
    focus = Math.max(0, focus - 0.01);
    planeMat.uniforms.focus.value = focus;
  }),
  createButton('+CameraZ', () => {
    plane.position.z += 0.1;
  }),
  createButton('-CameraZ', () => {
    plane.position.z -= 0.1;
  })
);

const raycaster = new THREE.Raycaster();

const controllers = [];

function initControllers() {
  for (let i = 0; i <= 1; i++) {
    const controller = renderer.xr.getController(i);
    scene.add(controller);
    controllers.push(controller);

    const controllerModel = controllerModelFactory.createControllerModel(controller);
    controller.add(controllerModel);

    const geometry = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, -1)]);
    const line = new THREE.Line(geometry);
    line.name = 'line';
    line.scale.z = 5;
    controller.add(line);
  }
}
initControllers();

renderer.xr.addEventListener('sessionstart', () => {
  isVRPresenting = true;
  useDeviceControls = true;
  plane.position.set(0,0,-2);
  planePts.position.set(0, 1.6, -2.01);
  plane.updateMatrix();
  uiContainer.visible = true;
  controllers.forEach(controller => {
    controller.addEventListener('selectstart', onSelectStart);
    controller.addEventListener('selectend', onSelectEnd);
  });
  console.log('Plane position set to:', plane.position);
  console.log('PlanePts position set to:', planePts.position);
});

renderer.xr.addEventListener('sessionend', () => {
  isVRPresenting = false;
  scene.position.set(0,0,0);
  uiContainer.visible = false;
  controllers.forEach(controller => {
    controller.removeEventListener('selectstart', onSelectStart);
    controller.removeEventListener('selectend', onSelectEnd);
    width = window.innerWidth;
    height = window.innerHeight;
    camera.aspect = width / height;
    gyroCamera.aspect = width / height;
    camera.updateProjectionMatrix();
    gyroCamera.updateProjectionMatrix();
    renderer.setSize(width, height);
    effect.setSize(width, height);
  
  });
});


function onSelectStart(event) {
  const controller = event.target;
  controller.userData.selectState = true;
}

function onSelectEnd(event) {
  const controller = event.target;
  controller.userData.selectState = false;

  // Reset button states
  uiContainer.children.forEach(child => {
    if (child.isUI) {
      child.setState('idle');
    }
  });
}


function handleController(controller) {
  const userData = controller.userData;
  const line = controller.getObjectByName('line');
  const tempMatrix = new THREE.Matrix4();
  tempMatrix.identity().extractRotation(controller.matrixWorld);

  raycaster.ray.origin.setFromMatrixPosition(controller.matrixWorld);
  raycaster.ray.direction.set(0, 0, -1).applyMatrix4(tempMatrix);

  const intersects = raycaster.intersectObjects(uiContainer.children, true);

  if (intersects.length > 0) {
    const res = intersects[0];
    res.object.parent.setState('hovered');
    if (userData.selectState) {
      res.object.parent.setState('selected');
      if (typeof res.object.parent.onClick === 'function') {
        res.object.parent.onClick();  // Ensure the onClick method is called
      }
    }
  }

  line.visible = true;
}
