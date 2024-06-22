import * as THREE from './vendor/three.module.js';
import { OrbitControls } from './vendor/OrbitControls.js';
import { StereoEffect } from './vendor/StereoEffects.js';
import { VRButton } from './vendor/VRButton.js';
import ThreeMeshUI from 'https://cdn.skypack.dev/three-mesh-ui';
import { XRControllerModelFactory } from './vendor/XRControllerModelFactory.js';
import VRControl from './vendor/VRControl.js';
// const controllerModelFactory = new XRControllerModelFactory();

let isVRPresenting = false;
let selectState = false;
let container;
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
const raycaster = new THREE.Raycaster();
let vrControl;
const objsToTest = [];

vrControl = VRControl( renderer, camera, scene );

scene.add( vrControl.controllerGrips[ 0 ], vrControl.controllers[ 0 ] );
	vrControl.controllers[ 0 ].addEventListener( 'selectstart', () => {
		selectState = true;
	} );
	vrControl.controllers[ 0 ].addEventListener( 'selectend', () => {
		selectState = false;
	} );

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
    
    // Hide all controls except gyro-button
    document.querySelectorAll('.controls > div').forEach(div => {
      if (!div.contains(gyroButton)) {
        div.style.display = 'none';
      } else {
        div.style.display = 'block';
      }
    });

  } else {
    controls.enabled = true;
    disableDeviceOrientationControls();
    console.log("Close the device control mode.");

    // Show all controls
    document.querySelectorAll('.controls > div').forEach(div => {
      div.style.display = 'block';
    });
  }
});

function requestPermission() {
  DeviceMotionEvent.requestPermission()
    .then(function (permissionState) {
      // granted:user permmited
      if (permissionState === 'granted') {
        rotate();
      } else {
        gyroButton.innerHTML = 'Please grant the permission.';
      }
    }).catch(function (err) {
      gyroButton.innerHTML = 'Permission request failed.';
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
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const progressElement = document.getElementById('progress');
    const filesrc = `./${sceneName}/${sceneName}.mp4`;
    canvas.width = resX;
    canvas.height = resY;
    canvas.setAttribute('id', 'videosrc');

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
      await fetchFrames();
      console.log('loaded data');
      controlsDiv.style.display = 'block'; // Show controls
      loadWrap.style.display = 'none'; // Hide load wrap 
    });

    // Fetch video file and cache it as a blob URL
    const response = await fetch(filesrc);
    const blob = await response.blob();
    const blobURL = URL.createObjectURL(blob);
    video.src = blobURL;

    video.load();

  } catch (error) {
    console.error('Error extracting video:', error);
    alert('An error occurred while extracting video.');
  }
}
function animate() {
  renderer.setAnimationLoop(() => {
    let activeCamera = useDeviceControls ? gyroCamera : camera;
    let intersect;
   
    if (!useDeviceControls) {
      controls.update();
    }
    // Update ThreeMeshUI
    ThreeMeshUI.update();

    if (renderer.xr.isPresenting) {
      vrControl.setFromController(0, raycaster.ray);
      intersect = raycast(); // 更新intersect变量
      // Position the little white dot at the end of the controller pointing ray
      if (intersect) vrControl.setPointerAt(0, intersect.point);
      updateButtons(intersect); // 传递intersect到updateButtons
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
  window.addEventListener('deviceorientation', handleDeviceOrientation, true);
}

function disableDeviceOrientationControls() {
  window.removeEventListener('deviceorientation', handleDeviceOrientation, true);
  initialOrientation = null;
}

function handleDeviceOrientation(event) {
  let alpha = event.alpha ? THREE.MathUtils.degToRad(event.alpha) : 0;
  const beta = event.beta ? THREE.MathUtils.degToRad(event.beta) : 0;
  let gamma = event.gamma ? THREE.MathUtils.degToRad(event.gamma) : 0;

 
  if (initialOrientation === null) {
    gamma += THREE.MathUtils.degToRad(90); // Correct for initial gamma offset
    alpha += THREE.MathUtils.degToRad(-90);
  }

  if (!initialOrientation) {
    // Set initial orientation based on current device orientation
    initialOrientation = {
      alpha: alpha,
      beta: beta,
      gamma: gamma
    };
  }

  updateCameraOrientation(alpha, beta, gamma);
}

function updateCameraOrientation(alpha, beta, gamma) {
  if (!initialOrientation) return;

  // Calculate offsets relative to initial orientation
  const alphaOffset = alpha - initialOrientation.alpha;
  const betaOffset = beta - initialOrientation.beta;
  const gammaOffset = gamma - initialOrientation.gamma;

  // Adjust Euler angles sequence and mapping for PICO 4 device
  const euler = new THREE.Euler(-gammaOffset, alphaOffset, -betaOffset, 'YXZ');
  gyroCamera.quaternion.setFromEuler(euler);
  gyroCamera.updateMatrixWorld(true);
}



// VR mode UI

function makePanel() {

	// Container block, in which we put the two buttons.
	// We don't define width and height, it will be set automatically from the children's dimensions
	// Note that we set contentDirection: "row-reverse", in order to orient the buttons horizontally

	  container = new ThreeMeshUI.Block( {
		justifyContent: 'center',
		contentDirection: 'row-reverse',
		fontFamily: './assets/Roboto-msdf.json',
		fontTexture: './assets/Roboto-msdf.png',
		fontSize: 0.07,
		padding: 0.02,
		borderRadius: 0.11,
    backgroundColor: new THREE.Color(0x222222),
    backgroundOpacity: 0.8
	} );

	container.position.set( 0, 0, -2 );
	container.rotation.x = -0.55;
	scene.add( container );

	// BUTTONS

	// We start by creating objects containing options that we will use with the two buttons,
	// in order to write less code.

	const buttonOptions = {
		width: 0.4,
		height: 0.15,
		justifyContent: 'center',
		offset: 0.05,
		margin: 0.02,
		borderRadius: 0.075
	};

	// Options for component.setupState().
	// It must contain a 'state' parameter, which you will refer to with component.setState( 'name-of-the-state' ).

	const hoveredStateAttributes = {
		state: 'hovered',
		attributes: {
			offset: 0.035,
			backgroundColor: new THREE.Color( 0x999999 ),
			backgroundOpacity: 1,
			fontColor: new THREE.Color( 0xffffff )
		},
	};

	const idleStateAttributes = {
		state: 'idle',
		attributes: {
			offset: 0.035,
			backgroundColor: new THREE.Color( 0x666666 ),
			backgroundOpacity: 0.3,
			fontColor: new THREE.Color( 0xffffff )
		},
	};

	// Buttons creation, with the options objects passed in parameters.

	const buttonApertureAdd = new ThreeMeshUI.Block( buttonOptions );
	const buttonApertureMinus = new ThreeMeshUI.Block( buttonOptions );
  const buttonFocusAdd = new ThreeMeshUI.Block( buttonOptions );
	const buttonFocusMinus = new ThreeMeshUI.Block( buttonOptions );
  const buttonCameraAdd = new ThreeMeshUI.Block( buttonOptions );
	const buttonCameraMinus = new ThreeMeshUI.Block( buttonOptions );

	// Add text to buttons

	buttonApertureAdd.add(
		new ThreeMeshUI.Text( { content: 'Aperture+' } )
	);

	buttonApertureMinus.add(
		new ThreeMeshUI.Text( { content: 'Aperture-' } )
	);
  buttonFocusAdd.add(
		new ThreeMeshUI.Text( { content: 'Focus+' } )
	);

	buttonFocusMinus.add(
		new ThreeMeshUI.Text( { content: 'Focus-' } )
	);
  buttonCameraAdd.add(
		new ThreeMeshUI.Text( { content: 'CameraZ+' } )
	);

	buttonCameraMinus.add(
		new ThreeMeshUI.Text( { content: 'CameraZ-' } )
	);

	// Create states for the buttons.
	// In the loop, we will call component.setState( 'state-name' ) when mouse hover or click

	const selectedAttributes = {
		offset: 0.02,
		backgroundColor: new THREE.Color( 0x777777 ),
		fontColor: new THREE.Color( 0x222222 )
	};

	buttonApertureAdd.setupState( {
		state: 'selected',
		attributes: selectedAttributes,
		onSet: () => {
       aperture += 0.1;
       planeMat.uniforms.aperture.value = aperture;
			//
		}
	} );
	buttonApertureAdd.setupState( hoveredStateAttributes );
	buttonApertureAdd.setupState( idleStateAttributes );

	//

	buttonApertureMinus.setupState( {
		state: 'selected',
		attributes: selectedAttributes,
		onSet: () => {

			aperture = Math.max(0,aperture - 0.1);
       planeMat.uniforms.aperture.value = aperture;

		}
	} );
	buttonApertureMinus.setupState( hoveredStateAttributes );
	buttonApertureMinus.setupState( idleStateAttributes );

	//
	buttonFocusAdd.setupState( {
		state: 'selected',
		attributes: selectedAttributes,
		onSet: () => {

			focus += 0.01;
      planeMat.uniforms.focus.value = focus;

		}
	} );
	buttonFocusMinus.setupState( hoveredStateAttributes );
	buttonFocusMinus.setupState( idleStateAttributes );

  //

  buttonFocusMinus.setupState( {
		state: 'selected',
		attributes: selectedAttributes,
		onSet: () => {

			focus = Math.max(-(focus - 0.01), focus - 0.01);
      planeMat.uniforms.focus.value = focus;

		}
	} );
	buttonFocusAdd.setupState( hoveredStateAttributes );
	buttonFocusAdd.setupState( idleStateAttributes );

  //

  buttonCameraAdd.setupState( {
		state: 'selected',
		attributes: selectedAttributes,
		onSet: () => {

			plane.position.z += 0.1;

		}
	} );
	buttonCameraAdd.setupState( hoveredStateAttributes );
	buttonCameraAdd.setupState( idleStateAttributes );
  
  //

  buttonCameraMinus.setupState( {
		state: 'selected',
		attributes: selectedAttributes,
		onSet: () => {

			plane.position.z -= 0.1;

		}
	} );
	buttonCameraMinus.setupState( hoveredStateAttributes );
	buttonCameraMinus.setupState( idleStateAttributes );
  
  //

	container.add( buttonCameraAdd,buttonApertureAdd,buttonApertureMinus,buttonCameraMinus,buttonFocusAdd,buttonFocusMinus );
	objsToTest.push( buttonCameraAdd,buttonApertureAdd,buttonApertureMinus,buttonCameraMinus,buttonFocusAdd,buttonFocusMinus );

}
function logError(context, error) {
  const errorMessage = {
    context: context,
    message: error.message,
    stack: error.stack
  };
  console.error(errorMessage);

  // 弹出错误信息
  alert(`Error occurred: ${context}\n${error.message}\n${error.stack}`);

  // 发送错误信息到服务器
  fetch('/logError', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(errorMessage)
  }).catch(err => {
    console.error('Error sending log to server:', err);
  });

  // 或者存储在本地存储中
  localStorage.setItem('lastError', JSON.stringify(errorMessage));
}

// 添加全局错误监听器
window.addEventListener('error', function (event) {
  logError('Global error', event.error);
});

window.addEventListener('unhandledrejection', function (event) {
  logError('Unhandled rejection', event.reason);
});

renderer.xr.addEventListener('sessionstart', () => {
  try {
    isVRPresenting = true;
    plane.position.set(0, 0, -2);
    planePts.position.set(0, 0, -2.01);
    plane.updateMatrix();
    makePanel(); // 调用makePanel函数
    scene.add(container); // 添加container到场景中
  } catch (error) {
    logError('Error during sessionstart', error);
  }
});

renderer.xr.addEventListener('sessionend', () => {
  try {
    isVRPresenting = false;
    scene.position.set(0, 0, 0);
    if (container) {
      scene.remove(container); // 从场景中移除container
    }
  } catch (error) {
    logError('Error during sessionend', error);
  }
});

window.addEventListener('load', function() {
  const lastError = localStorage.getItem('lastError');
  if (lastError) {
    const error = JSON.parse(lastError);
    console.error('Last error before refresh:', error);
    // 清除本地存储中的错误信息，以避免重复显示
    localStorage.removeItem('lastError');
  }
});
// 阻止页面强制刷新
window.addEventListener('beforeunload', function(event) {
  const lastError = localStorage.getItem('lastError');
  if (lastError) {
    // 提示用户确认离开页面
    event.preventDefault();
    event.returnValue = ''; // 标准兼容方式
  }
});

function raycast() {

	return objsToTest.reduce( ( closestIntersection, obj ) => {

		const intersection = raycaster.intersectObject( obj, true );

		if ( !intersection[ 0 ] ) return closestIntersection;

		if ( !closestIntersection || intersection[ 0 ].distance < closestIntersection.distance ) {

			intersection[ 0 ].object = obj;

			return intersection[ 0 ];

		}

		return closestIntersection;

	}, null );

}
function updateButtons(intersect){

  if ( intersect && intersect.object.isUI ) {
		if ( selectState ) {
			// Component.setState internally call component.set with the options you defined in component.setupState
			intersect.object.setState( 'selected' );
		} else {
			// Component.setState internally call component.set with the options you defined in component.setupState
			intersect.object.setState( 'hovered' );
		}
	}
	// Update non-targeted buttons state
	objsToTest.forEach( ( obj ) => {
		if ( ( !intersect || obj !== intersect.object ) && obj.isUI ) {
			// Component.setState internally call component.set with the options you defined in component.setupState
			obj.setState( 'idle' );
		}
	});
}
