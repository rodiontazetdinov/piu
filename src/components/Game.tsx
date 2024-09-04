//@ts-nocheck
import React, { useEffect, useRef, useReducer, useState, useCallback } from 'react';
import player2ImageLink from '../assets/superhero_2503200.png';
import player1ImageLink from '../assets/superhero_4402821.png';

const PLAYER_WIDTH = 50;
const PLAYER_HEIGHT = 50; // Увеличено для соответствия размеру иконок
const LASER_WIDTH = 2;
const LASER_HEIGHT = 10;
const LASER_SPEED = 20; // Увеличено для быстрого лазера
const PLAYER_SPEED = 10;
const INITIAL_LIVES = 3;
const EXPLOSION_DURATION = 60;
const RELOAD_TIME = 3000; // 3 секунды в миллисекундах
const MAX_LASERS = 50;
const MAX_EXPLOSIONS = 10;

const initialState = {
  player1: { x: 0, y: 0, lives: INITIAL_LIVES, canShoot: true, reloadProgress: 100 },
  player2: { x: 0, y: 0, lives: INITIAL_LIVES, canShoot: true, reloadProgress: 100 },
  lasers: [],
  explosions: [],
  gameOver: false
};

function gameReducer(state, action) {
  switch (action.type) {
    case 'INIT_GAME':
      return {
        ...state,
        player1: { x: action.width / 2 - PLAYER_WIDTH / 2, y: action.height - PLAYER_HEIGHT - 50, lives: INITIAL_LIVES, canShoot: true, reloadProgress: 100 },
        player2: { x: action.width / 2 - PLAYER_WIDTH / 2, y: PLAYER_HEIGHT + 10, lives: INITIAL_LIVES, canShoot: true, reloadProgress: 100 }
      };
    case 'MOVE_PLAYER':
      return {
        ...state,
        [action.player]: {
          ...state[action.player],
          x: Math.max(0, Math.min(action.width - PLAYER_WIDTH, action.x))
        }
      };
    case 'SHOOT_LASER':
      if (!state[action.player].canShoot) return state;
      return {
        ...state,
        [action.player]: { ...state[action.player], canShoot: false, reloadProgress: 0 },
        lasers: [...state.lasers, {
          x: state[action.player].x + PLAYER_WIDTH / 2 - LASER_WIDTH / 2,
          y: action.player === 'player1' ? state[action.player].y - LASER_HEIGHT : state[action.player].y + PLAYER_HEIGHT,
          height: action.height,
          player: action.player
        }].slice(-MAX_LASERS)
      };
    case 'UPDATE_RELOAD':
      return {
        ...state,
        player1: {
          ...state.player1,
          reloadProgress: Math.min(100, state.player1.reloadProgress + action.delta),
          canShoot: state.player1.reloadProgress + action.delta >= 100
        },
        player2: {
          ...state.player2,
          reloadProgress: Math.min(100, state.player2.reloadProgress + action.delta),
          canShoot: state.player2.reloadProgress + action.delta >= 100
        }
      };
    case 'UPDATE_LASERS':
      const newLasers = state.lasers.reduce((acc, laser) => {
        const newY = laser.player === 'player1' ? laser.y - LASER_SPEED : laser.y + LASER_SPEED;
        const targetPlayer = laser.player === 'player1' ? 'player2' : 'player1';
        
        if (checkCollision({ ...laser, y: newY }, state[targetPlayer])) {
          // Нанесение урона при попадании
          return {
            lasers: acc.lasers,
            players: {
              ...acc.players,
              [targetPlayer]: {
                ...acc.players[targetPlayer],
                lives: acc.players[targetPlayer].lives - 1
              }
            },
            explosions: acc.players[targetPlayer].lives <= 1 ? [
              ...acc.explosions,
              {
                x: state[targetPlayer].x + PLAYER_WIDTH / 2,
                y: state[targetPlayer].y + PLAYER_HEIGHT / 2,
                frame: 0
              }
            ] : acc.explosions
          };
        } else if (
          (laser.player === 'player1' && newY + laser.height >= 0) ||
          (laser.player === 'player2' && newY <= action.height)
        ) {
          return {
            ...acc,
            lasers: [...acc.lasers, { ...laser, y: newY }]
          };
        }
        return acc;
      }, { lasers: [], players: state, explosions: state.explosions });

      return {
        ...state,
        ...newLasers.players,
        lasers: newLasers.lasers,
        explosions: newLasers.explosions
      };
    case 'UPDATE_EXPLOSIONS':
      const updatedExplosions = state.explosions
        .map(explosion => ({ ...explosion, frame: explosion.frame + 1 }))
        .filter(explosion => explosion.frame < EXPLOSION_DURATION)
        .slice(-MAX_EXPLOSIONS);
      
      return {
        ...state,
        explosions: updatedExplosions,
        gameOver: updatedExplosions.length === 0 && (state.player1.lives <= 0 || state.player2.lives <= 0)
      };
    case 'RESTART_GAME':
      return {
        ...initialState,
        player1: { ...initialState.player1, x: action.width / 2 - PLAYER_WIDTH / 2, y: action.height - PLAYER_HEIGHT - 50 },
        player2: { ...initialState.player2, x: action.width / 2 - PLAYER_WIDTH / 2, y: PLAYER_HEIGHT + 10 }
      };
    default:
      return state;
  }
}

function checkCollision(laser, player) {
  return (
    laser.x < player.x + PLAYER_WIDTH &&
    laser.x + LASER_WIDTH > player.x &&
    ((laser.player === 'player1' && laser.y < player.y + PLAYER_HEIGHT) ||
     (laser.player === 'player2' && laser.y > player.y))
  );
}

const Game = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [state, dispatch] = useReducer(gameReducer, initialState);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [images, setImages] = useState({ player1: null, player2: null });
  const [dragging, setDragging] = useState(null);

  useEffect(() => {
    const loadImages = async () => {
      const player1Image = new Image();
      const player2Image = new Image();
      
      player1Image.src = player1ImageLink; // Замените на путь к вашему изображению
      player2Image.src = player2ImageLink; // Замените на путь к вашему изображению
      
      await Promise.all([
        new Promise(resolve => player1Image.onload = resolve),
        new Promise(resolve => player2Image.onload = resolve)
      ]);
      
      setImages({ player1: player1Image, player2: player2Image });
    };
    
    loadImages();
  }, []);

  useEffect(() => {
    const updateDimensions = () => {
      const width = window.innerWidth;
      const height = window.innerHeight; // Убрали вычитание 100px
      setDimensions({ width, height });
      dispatch({ type: 'INIT_GAME', width, height });
    };

    updateDimensions();
    window.addEventListener('resize', updateDimensions);

    return () => window.removeEventListener('resize', updateDimensions);
  }, []);

  useEffect(() => {
    if (dimensions.width === 0 || dimensions.height === 0 || !images.player1 || !images.player2) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');

    let animationFrameId;

    const gameLoop = () => {
      ctx.clearRect(0, 0, dimensions.width, dimensions.height);

      // Отрисовка игроков
      if (state.player1.lives > 0) {
        ctx.drawImage(images.player1, state.player1.x, state.player1.y, PLAYER_WIDTH, PLAYER_HEIGHT);
      }
      if (state.player2.lives > 0) {
        ctx.drawImage(images.player2, state.player2.x, state.player2.y, PLAYER_WIDTH, PLAYER_HEIGHT);
      }

      // Отрисовка полосок здоровья и перезарядки
      const drawBars = (player, y, isPlayer1) => {
        // Полоска здоровья
        const healthWidth = (PLAYER_WIDTH * player.lives) / INITIAL_LIVES;
        ctx.fillStyle = 'gray';
        ctx.fillRect(player.x, y, PLAYER_WIDTH, 5);
        ctx.fillStyle = isPlayer1 ? 'lime' : 'pink';
        ctx.fillRect(player.x, y, healthWidth, 5);

        // Полоска перезарядки
        const reloadWidth = (PLAYER_WIDTH * player.reloadProgress) / 100;
        ctx.fillStyle = 'gray';
        ctx.fillRect(player.x, y + 7, PLAYER_WIDTH, 3);
        ctx.fillStyle = 'yellow';
        ctx.fillRect(player.x, y + 7, reloadWidth, 3);
      };

      if (state.player1.lives > 0) drawBars(state.player1, state.player1.y + PLAYER_HEIGHT + 5, true);
      if (state.player2.lives > 0) drawBars(state.player2, state.player2.y - 15, false);

      // Отрисовка лазеров
      ctx.fillStyle = 'yellow';
      ctx.beginPath();
      state.lasers.forEach(laser => {
        if (laser.player === 'player1') {
          ctx.rect(laser.x, laser.y, LASER_WIDTH, -laser.height);
        } else {
          ctx.rect(laser.x, laser.y, LASER_WIDTH, laser.height);
        }
      });
      ctx.fill();

      // Отрисовка взрывов
      state.explosions.forEach(explosion => {
        const radius = (explosion.frame / EXPLOSION_DURATION) * 50;
        const alpha = 1 - (explosion.frame / EXPLOSION_DURATION);
        ctx.beginPath();
        ctx.arc(explosion.x, explosion.y, radius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 100, 0, ${alpha})`;
        ctx.fill();
      });

      // Отображение жизней текстом
      ctx.fillStyle = 'white';
      ctx.font = '20px Arial';
      ctx.fillText(`Зеленый: ${state.player1.lives}`, 10, dimensions.height - 30); // Подняли текст на 20 пикселей выше
      ctx.fillText(`Красный: ${state.player2.lives}`, dimensions.width - 120, 30);

      animationFrameId = requestAnimationFrame(gameLoop);
    };

    gameLoop();

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [state, dimensions, images]);

  useEffect(() => {
    const updateGame = () => {
      dispatch({ type: 'UPDATE_PLAYERS', width: dimensions.width });
      dispatch({ type: 'UPDATE_LASERS', height: dimensions.height });
      dispatch({ type: 'UPDATE_EXPLOSIONS' });
      dispatch({ type: 'UPDATE_RELOAD', delta: (16 / RELOAD_TIME) * 100 }); // Обновление прогресса перезарядки
    };

    const intervalId = setInterval(updateGame, 16); // Примерно 60 FPS

    return () => clearInterval(intervalId);
  }, [dimensions]);

  const handleMouseDown = useCallback((e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (y > dimensions.height / 2) {
      setDragging('player1');
    } else {
      setDragging('player2');
    }
  }, [dimensions]);

  const handleMouseMove = useCallback((e) => {
    if (dragging) {
      const rect = canvasRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      dispatch({ type: 'MOVE_PLAYER', player: dragging, x, width: dimensions.width });
    }
  }, [dragging, dimensions]);

  const handleMouseUp = useCallback(() => {
    if (dragging) {
      if (dragging === 'player1' && state.player1.canShoot) {
        dispatch({ type: 'SHOOT_LASER', player: 'player1', height: dimensions.height });
      } else if (dragging === 'player2' && state.player2.canShoot) {
        dispatch({ type: 'SHOOT_LASER', player: 'player2', height: dimensions.height });
      }
    }
    setDragging(null);
  }, [dragging, dimensions, state.player1.canShoot, state.player2.canShoot]);

  const handleTouchStart = useCallback((e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    const touch = e.touches[0];
    const x = touch.clientX - rect.left;
    const y = touch.clientY - rect.top;

    if (y > dimensions.height / 2) {
      setDragging('player1');
    } else {
      setDragging('player2');
    }
  }, [dimensions]);

  const handleTouchMove = useCallback((e) => {
    if (dragging) {
      const rect = canvasRef.current.getBoundingClientRect();
      const touch = e.touches[0];
      const x = touch.clientX - rect.left;
      dispatch({ type: 'MOVE_PLAYER', player: dragging, x, width: dimensions.width });
    }
  }, [dragging, dimensions]);

  const handleTouchEnd = useCallback(() => {
    if (dragging) {
      if (dragging === 'player1' && state.player1.canShoot) {
        dispatch({ type: 'SHOOT_LASER', player: 'player1', height: dimensions.height });
      } else if (dragging === 'player2' && state.player2.canShoot) {
        dispatch({ type: 'SHOOT_LASER', player: 'player2', height: dimensions.height });
      }
    }
    setDragging(null);
  }, [dragging, dimensions, state.player1.canShoot, state.player2.canShoot]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas) {
      canvas.addEventListener('mousedown', handleMouseDown);
      canvas.addEventListener('mousemove', handleMouseMove);
      canvas.addEventListener('mouseup', handleMouseUp);
      canvas.addEventListener('mouseleave', handleMouseUp);
      canvas.addEventListener('touchstart', handleTouchStart);
      canvas.addEventListener('touchmove', handleTouchMove);
      canvas.addEventListener('touchend', handleTouchEnd);

      return () => {
        canvas.removeEventListener('mousedown', handleMouseDown);
        canvas.removeEventListener('mousemove', handleMouseMove);
        canvas.removeEventListener('mouseup', handleMouseUp);
        canvas.removeEventListener('mouseleave', handleMouseUp);
        canvas.removeEventListener('touchstart', handleTouchStart);
        canvas.removeEventListener('touchmove', handleTouchMove);
        canvas.removeEventListener('touchend', handleTouchEnd);
      };
    }
  }, [handleMouseDown, handleMouseMove, handleMouseUp, handleTouchStart, handleTouchMove, handleTouchEnd]);

  const handleRestart = useCallback(() => {
    dispatch({ type: 'RESTART_GAME', width: dimensions.width, height: dimensions.height });
  }, [dimensions]);

  return (
    <div style={{ 
      display: 'flex', 
      flexDirection: 'column', 
      height: '100vh', 
      width: '100vw', // Добавили ширину 100vw
      overflow: 'hidden', // Скрываем возможные полосы прокрутки
      position: 'relative', 
      background: 'linear-gradient(-45deg, #ee7752, #e73c7e, #23a6d5, #23d5ab)',
      backgroundSize: '400% 400%',
      animation: 'gradientBG 15s ease infinite'
    }}>
      <style>
        {`
          @keyframes gradientBG {
            0% {
              background-position: 0% 50%;
            }
            50% {
              background-position: 100% 50%;
            }
            100% {
              background-position: 0% 50%;
            }
          }
        `}
      </style>
      <canvas 
        ref={canvasRef} 
        width={dimensions.width} 
        height={dimensions.height} 
        style={{ display: 'block', position: 'absolute', top: 0, left: 0 }}
      />
      {state.gameOver && (
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          textAlign: 'center'
        }}>
          <h2 style={{ color: 'white' }}>
            {state.player1.lives <= 0 ? 'Красный игрок победил!' : 'Зеленый игрок победил!'}
          </h2>
          <button 
            onClick={handleRestart}
            style={{
              fontSize: '24px',
              padding: '10px 20px',
              backgroundColor: '#4CAF50',
              color: 'white',
              border: 'none',
              borderRadius: '5px',
              cursor: 'pointer'
            }}
            
          >
            Рестарт
          </button>
        </div>
      )}
    </div>
  );
};

export default Game;
