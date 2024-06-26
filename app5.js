import * as THREE from './vendor/three.module.js';
import { OrbitControls } from './vendor/OrbitControls.js';
import { StereoEffect } from './vendor/StereoEffects.js';
import { VRButton } from './vendor/VRButton.js';
import ThreeMeshUI from 'https://cdn.skypack.dev/three-mesh-ui';
import VRControl from './vendor/VRControl.js';
import { DeviceOrientationControls } from './vendor/DeviceOrientationControls.js';

// 非VR模式下UI
const apertureInput = document.querySelector('#aperture');
const focusInput = document.querySelector('#focus');
const stInput = document.querySelector('#stplane');
const loadWrap = document.querySelector('#load-wrap');
const gyroButton = document.querySelector('#gyro-button');
const controlsDiv = document.querySelector('.controls');
const progressContainer = document.querySelector('#progress-container');
const backButton = document.querySelector('#back-button');
const resetButton = document.querySelector('#reset-button')

// 加载页面按钮
const amethystButton = document.querySelector('#amethyst');
const legoKnightsButton = document.querySelector('#legoKnights');
const legoTruckButton = document.querySelector('#legoTruck');
const theStanfordBunnyButton = document.querySelector('#theStanfordBunny');
const tarotCardsAndCrystalBallButton = document.querySelector('#tarotCardsAndCrystalBall');

// 创建场景、相机等
const scene = new THREE.Scene();
let width = window.innerWidth;
let height = window.innerHeight;
const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
const gyroCamera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
const renderer = new THREE.WebGLRenderer({ antialias: true });
let fragmentShader, vertexShader;
renderer.setSize(width, height);
document.body.appendChild(renderer.domElement);
document.body.appendChild(VRButton.createButton(renderer));

// 启用StereoEffect
let isStereoView = true;
const effect = new StereoEffect(renderer);

// 普通相机相关
camera.position.z = 2;
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.target = new THREE.Vector3(0, 0, 1);
controls.panSpeed = 2;
controls.enabled = true; 

//陀螺仪相机相关
let useDeviceControls = false;
gyroCamera.position.z = 2;
const deviceOrientationControls = new DeviceOrientationControls(gyroCamera);
deviceOrientationControls.target = new THREE.Vector3(0, 0, 1);
deviceOrientationControls.panSpeed = 2;
deviceOrientationControls.enabled = false; 


//纹理、平面相关：分辨率、相机数量、焦距、光圈，相机间的距离
let fieldTexture;
let plane, planeMat, planePts;
const camsX = 17;
const camsY = 17;
let resX;
let resY;
const cameraGap = 0.08;
let aperture = Number(apertureInput.value);
let focus = Number(focusInput.value);
let apertureMax = 10;
let focusMin = -0.01;
let focusMax = 0.01;

// 启用VConsole
const vConsole = new VConsole();

// VR部分相关：射线、控制器、UI
renderer.xr.enabled = true;
const raycaster = new THREE.Raycaster();
let vrControl;
const objsToTest = [];
let isVRPresenting = false;
let selectState = false;
let container;

// 尺寸适应
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

// 非VR模式下UI控制
apertureInput.addEventListener('input', e => { // 光圈按钮
  aperture = Number(apertureInput.value);
  planeMat.uniforms.aperture.value = aperture;
});

focusInput.addEventListener('input', e => { // 焦距按钮
  focus = Number(focusInput.value);
  planeMat.uniforms.focus.value = focus;
});

stInput.addEventListener('input', () => { // 点阵图开启checkbox
  planePts.visible = stInput.checked;
});

gyroButton.addEventListener('click', () => { // 陀螺仪相机按钮
  useDeviceControls = !useDeviceControls;
  if (useDeviceControls) {
    controls.enabled = false;
    deviceOrientationControls.enabled = true;
    console.log("Start the device control mode.");
    // 陀螺仪模式下隐藏其他UI
    document.querySelectorAll('.controls > div').forEach(div => {
      if (!div.contains(gyroButton)) {
        div.style.display = 'none';
      } else {
        div.style.display = 'block';
      }
    });
  } else {
    controls.enabled = true;
    deviceOrientationControls.enabled = false;
    console.log("Close the device control mode.");
    // 关闭陀螺仪模式后显示其他UI
    document.querySelectorAll('.controls > div').forEach(div => {
      div.style.display = 'block';
    });
  }
});

backButton.addEventListener('click', () => { // 返回按钮
  loadWrap.style.display = 'flex';
  controlsDiv.style.display = 'none';
  progressContainer.style.display = 'none'; 
  scene.remove(plane);
  scene.remove(planePts);
  if (planeMat) {
    planeMat.dispose();
  }
  if (fieldTexture) {
    fieldTexture.dispose();
  }
  console.log('Returned to main menu.');
});

resetButton.addEventListener('click', () => { // 重制位置按钮
  if(useDeviceControls){
    gyroCamera.position.set(0,0,2);
    deviceOrientationControls.target = new THREE.Vector3(0, 0, 1);
  }
  else{
    camera.position.set(0,0,2);
    controls.target = new THREE.Vector3(0, 0, 1);
  }
  console.log('Reset the position.');
});


// 加载光场数据 传入名称与分辨率
amethystButton.addEventListener('click', () => loadLightField('Amethyst', 384, 512));
legoKnightsButton.addEventListener('click', () => loadLightField('LegoKnights', 512, 512));
legoTruckButton.addEventListener('click', () => loadLightField('LegoTruck', 640, 480));
theStanfordBunnyButton.addEventListener('click', () => loadLightField('TheStanfordBunny', 512, 512));
tarotCardsAndCrystalBallButton.addEventListener('click', () => loadLightField('TarotCardsAndCrystalBall', 512, 512));

async function loadLightField(sceneName, resolutionX, resolutionY) {
  resX = resolutionX;
  resY = resolutionY;
  controlsDiv.style.display = 'none';
  progressContainer.style.display = 'block';
  await loadShaders();
  initPlaneMaterial();
  await extractVideo(sceneName);
  loadPlane();
  animate();
}

// 加载着色器代码
async function loadShaders() {
  const [vertexShaderRes, fragmentShaderRes] = await Promise.all([
    fetch('./vertex.glsl'),
    fetch('./fragment.glsl')
  ]);
  vertexShader = await vertexShaderRes.text();
  fragmentShader = await fragmentShaderRes.text();
}

// 初始化平面材质
function initPlaneMaterial() {
  planeMat = new THREE.ShaderMaterial({
    uniforms: {
      field: { value: null },
      camArraySize: new THREE.Uniform(new THREE.Vector2(camsX, camsY)),
      aperture: { value: aperture },
      focus: { value: focus },
      imageAspect: { value: resX / resY }
    },
    vertexShader,
    fragmentShader,
  });
  console.log("res:",resX,resY);
}

// 加载平面
function loadPlane() {
  const aspect = resX / resY;

  // 点阵
  const planeGeo = new THREE.PlaneGeometry(camsX * cameraGap * 8 * aspect, camsY * cameraGap * 8, camsX, camsY);
  const ptsMat = new THREE.PointsMaterial({ size: 0.01, color: 0xeeccff });
  planePts = new THREE.Points(planePtsGeo, ptsMat);
  planePts.visible = stInput.checked;
  planePts.position.set(0, 0, -0.01);

  // 平面
  const planePtsGeo = new THREE.PlaneGeometry(camsX * cameraGap * 4 * aspect, camsY * cameraGap * 4, camsX, camsY);
  plane = new THREE.Mesh(planeGeo, planeMat);
 
  scene.add(planePts);
  scene.add(plane);
  console.log('Loaded plane');
}

// 处理光场数据
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
    let offset = 0; // 用于跟踪当前在allBuffer中写入位置
    const allBuffer = new Uint8Array(resX * resY * 4 * camsX * camsY);

    // 将当前帧绘制到画布，并提取数据
    const getBufferFromVideo = () => {
      ctx.drawImage(video, 0, 0, resX, resY);
      const imgData = ctx.getImageData(0, 0, resX, resY);
      allBuffer.set(imgData.data, offset); // 将提取到的图像数据存储到缓冲区中，从 offset 位置开始
      offset += imgData.data.byteLength; // 更新 offset，使其指向下一个可用位置，以便下一个视频帧的数据可以正确存储
      count++;
      progressElement.textContent = `Loaded ${Math.round(100 * count / (camsX * camsY))}%`;
    };

    // 逐帧提取视频数据
    const fetchFrames = async () => {
      let currentTime = 0;
      while (count < camsX * camsY) {
        getBufferFromVideo();
        currentTime += 0.0333; // 每秒30帧的间隔
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
      controlsDiv.style.display = 'block';
      loadWrap.style.display = 'none';
    });

    // 先将视频Load到本地
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

// 动画循环
function animate() {
  renderer.setAnimationLoop(() => {
    let activeCamera = useDeviceControls ? gyroCamera : camera;
    let intersect;
    if (useDeviceControls) {
      deviceOrientationControls.update();
    } else {
      controls.update();
    }
    // 更新VR模式下UI
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

// VR控制器部分
vrControl = VRControl( renderer, camera, scene );
scene.add( vrControl.controllerGrips[ 0 ], vrControl.controllers[ 0 ] );
	vrControl.controllers[ 0 ].addEventListener( 'selectstart', () => {
		selectState = true;
	} );
	vrControl.controllers[ 0 ].addEventListener( 'selectend', () => {
		selectState = false;
	} );


// VR模式的UI
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
       aperture = Math.min(aperture,apertureMax);
       planeMat.uniforms.aperture.value = aperture;
		}
	} );
	buttonApertureAdd.setupState( hoveredStateAttributes );
	buttonApertureAdd.setupState( idleStateAttributes );

	//

	buttonApertureMinus.setupState( {
		state: 'selected',
		attributes: selectedAttributes,
		onSet: () => {
			aperture -= 0.1;
			aperture = Math.max(0,aperture);
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
			focus += 0.001;
      focus = Math.min(focusMax,focus);
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
			focus -= 0.001;
			focus = Math.max(focusMin, focus);
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

// 更新按钮
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

// 进入VR模式后的一些设置
renderer.xr.addEventListener('sessionstart', () => {
  isVRPresenting = true;
  plane.position.set(0,0,-2);
  planePts.position.set(0, 0, -2.01); // 若使用模拟器 就将y坐标重置为1.6
  plane.updateMatrix();
  makePanel(); 
  scene.add(container); 
  // VR模式下禁用 StereoEffect
  isStereoView = false;
});

renderer.xr.addEventListener('sessionend', () => {
  isVRPresenting = false;
  scene.position.set(0,0,0);
  if (container) {
    scene.remove(container);
  }
  // 恢复 StereoEffect
  isStereoView = true;
});

// 射线部分
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

// 错误捕获部分
// 记录强制刷新之前的Bug
function logError(context, error) {
  const errorMessage = {
    context: context,
    message: error.message,
    stack: error.stack
  };
  console.error(errorMessage);

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
  }
});
