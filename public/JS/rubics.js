let scene, camera, renderer, cubeGroup;
        let isDragging = false;
        let previousMousePosition = { x: 0, y: 0 };
        let isRotating = false;

        const COLORS = {
            front: 0xff0000, // Red
            back: 0xff6600,  // orange
            top: 0xffffff,   // White
            bottom: 0xffff00,// Yellow
            left: 0x008000,  // Green
            right: 0x0000ff, // Blue
            inside: 0x111111 // Black
        };

        const pieceSize = 0.94;
        const pieces = [];

        function init() {
            // Setup Scene
            scene = new THREE.Scene();
            
            // Setup Camera
            camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
            camera.position.set(5, 5, 8);
            camera.lookAt(0, 0, 0);

            // Setup Renderer
            renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
            renderer.setSize(window.innerWidth, window.innerHeight);
            renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
            renderer.setClearColor(0x1a1a1a, 1);
            document.body.appendChild(renderer.domElement);

            // Lighting
            const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
            scene.add(ambientLight);
            
            const sun = new THREE.DirectionalLight(0xffffff, 0.6);
            sun.position.set(10, 20, 10);
            scene.add(sun);

            // Cube Group
            cubeGroup = new THREE.Group();
            scene.add(cubeGroup);

            createCube();

            // Interactions
            window.addEventListener('mousedown', (e) => { 
                isDragging = true; 
                previousMousePosition = { x: e.clientX, y: e.clientY }; 
            });
            window.addEventListener('mouseup', () => isDragging = false);
            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('keydown', handleKeyDown);
            window.addEventListener('resize', onWindowResize);

            // Touch events
            window.addEventListener('touchstart', (e) => {
                isDragging = true;
                previousMousePosition = { x: e.touches[0].pageX, y: e.touches[0].pageY };
            }, { passive: false });
            window.addEventListener('touchend', () => isDragging = false);
            window.addEventListener('touchmove', (e) => {
                handleMouseMove({ 
                    clientX: e.touches[0].pageX, 
                    clientY: e.touches[0].pageY 
                });
            }, { passive: false });

            animate();
        }

        function createCube() {
            // Clear pieces array and group if re-initializing
            pieces.length = 0;
            
            for (let x = -1; x <= 1; x++) {
                for (let y = -1; y <= 1; y++) {
                    for (let z = -1; z <= 1; z++) {
                        const materials = [
                            new THREE.MeshLambertMaterial({ color: x === 1 ? COLORS.right : COLORS.inside }),
                            new THREE.MeshLambertMaterial({ color: x === -1 ? COLORS.left : COLORS.inside }),
                            new THREE.MeshLambertMaterial({ color: y === 1 ? COLORS.top : COLORS.inside }),
                            new THREE.MeshLambertMaterial({ color: y === -1 ? COLORS.bottom : COLORS.inside }),
                            new THREE.MeshLambertMaterial({ color: z === 1 ? COLORS.front : COLORS.inside }),
                            new THREE.MeshLambertMaterial({ color: z === -1 ? COLORS.back : COLORS.inside })
                        ];

                        const geometry = new THREE.BoxGeometry(pieceSize, pieceSize, pieceSize);
                        const piece = new THREE.Mesh(geometry, materials);
                        piece.position.set(x, y, z);
                        
                        // Add Black Outlines
                        const edges = new THREE.EdgesGeometry(geometry);
                        const line = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: 0x000000, linewidth: 2 }));
                        piece.add(line);

                        pieces.push(piece);
                        cubeGroup.add(piece);
                    }
                }
            }
        }

        function rotateFace(face, clockwise = true) {
            if (isRotating) return;
            isRotating = true;

            const pivot = new THREE.Group();
            scene.add(pivot);

            const rotationAxis = {
                'T': new THREE.Vector3(0, 1, 0),
                'D': new THREE.Vector3(0, -1, 0),
                'L': new THREE.Vector3(-1, 0, 0),
                'R': new THREE.Vector3(1, 0, 0),
                'F': new THREE.Vector3(0, 0, 1),
                'B': new THREE.Vector3(0, 0, -1)
            }[face];

            const condition = {
                'T': (p) => p.position.y > 0.5,
                'D': (p) => p.position.y < -0.5,
                'L': (p) => p.position.x < -0.5,
                'R': (p) => p.position.x > 0.5,
                'F': (p) => p.position.z > 0.5,
                'B': (p) => p.position.z < -0.5
            }[face];

            const facePieces = pieces.filter(condition);
            facePieces.forEach(p => {
                cubeGroup.remove(p);
                pivot.add(p);
            });

            const targetRotation = (clockwise ? -Math.PI / 2 : Math.PI / 2);
            const duration = 250; 
            const startTime = performance.now();

            function animateRotation(now) {
                const elapsed = now - startTime;
                const progress = Math.min(elapsed / duration, 1);
                
                // Reset rotation and apply incremental for smooth animation
                pivot.rotation.set(0, 0, 0);
                pivot.rotateOnAxis(rotationAxis, progress * targetRotation);

                if (progress < 1) {
                    requestAnimationFrame(animateRotation);
                } else {
                    pivot.updateMatrixWorld();
                    facePieces.forEach(p => {
                        p.applyMatrix4(pivot.matrixWorld);
                        // Sanitize positions to prevent floating point drift
                        p.position.x = Math.round(p.position.x);
                        p.position.y = Math.round(p.position.y);
                        p.position.z = Math.round(p.position.z);
                        pivot.remove(p);
                        cubeGroup.add(p);
                    });
                    scene.remove(pivot);
                    isRotating = false;
                }
            }
            requestAnimationFrame(animateRotation);
        }

        function scramble() {
            const moves = ['T', 'D', 'L', 'R', 'F', 'B'];
            let count = 0;
            const interval = setInterval(() => {
                if (!isRotating) {
                    rotateFace(moves[Math.floor(Math.random() * moves.length)], Math.random() > 0.5);
                    count++;
                }
                if (count >= 15) clearInterval(interval);
            }, 300);
        }

        function handleMouseMove(e) {
            if (!isDragging) return;
            const deltaMove = { x: e.clientX - previousMousePosition.x, y: e.clientY - previousMousePosition.y };
            
            const rotationQuaternion = new THREE.Quaternion().setFromEuler(
                new THREE.Euler(toRadians(deltaMove.y * 0.5), toRadians(deltaMove.x * 0.5), 0, 'XYZ')
            );
            
            cubeGroup.quaternion.multiplyQuaternions(rotationQuaternion, cubeGroup.quaternion);
            previousMousePosition = { x: e.clientX, y: e.clientY };
        }

        function handleKeyDown(e) {
            const key = e.key.toUpperCase();
            if (['T', 'D', 'L', 'R', 'F', 'B'].includes(key)) rotateFace(key, !e.shiftKey);
        }

        function toRadians(angle) { return angle * (Math.PI / 180); }

        function onWindowResize() {
            camera.aspect = window.innerWidth / window.innerHeight;
            camera.updateProjectionMatrix();
            renderer.setSize(window.innerWidth, window.innerHeight);
        }

        function animate() {
            requestAnimationFrame(animate);
            renderer.render(scene, camera);
        }

        // Use window.onload to ensure script runs after DOM is ready
        window.addEventListener('load', init);