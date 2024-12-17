export class ProfileHandler {
    constructor(bot) {
      this.bot = bot;
    }
    
    //Image & Canvas Fun!

    // Draw Hand-Drawn Container
    drawHandDrawnContainer (ctx, x, y, width, height) {
        ctx.strokeStyle = '#555';
        ctx.lineWidth = 1.5;
        if(y < 400) { ctx.lineWidth = 1; ctx.strokeStyle = '#444';} //hack, we want a diff color for userprofile container, & we know its way up less than 400Y
        ctx.beginPath();
        ctx.moveTo(x + 20, y);
        ctx.lineTo(x + width - 20, y + 10);
        ctx.lineTo(x + width, y + height - 20);
        ctx.lineTo(x + 10, y + height);
        ctx.lineTo(x - 20, y + height - 10);
        ctx.closePath();
        ctx.stroke();
    };
  
    drawMetallicBud(ctx, centerX, centerY, color) {
        const radius = 4;
        const gradient = ctx.createRadialGradient(centerX, centerY, 1, centerX, centerY, radius);
        
        // Gradient stops for metallic appearance
        gradient.addColorStop(0, color); // Bright yellow center
        gradient.addColorStop(0.4, 'rgba(255, 255, 0, 1)'); // Bright yellow for a metallic highlight
        gradient.addColorStop(0.7, 'rgba(255, 215, 0, 0.8)'); // Golden yellow
        gradient.addColorStop(1, 'rgba(120, 120, 120, 1)'); // Dark metallic edge
    
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
        ctx.closePath();
        ctx.fill();
    
        // Add a metallic glint for added effect
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)'; // White glint
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(centerX - 1, centerY - 2, radius / 2.5, 0, Math.PI * 2); // Small glint near the top left
        ctx.stroke();
    }
  
    drawVerticalBracketWithNodes(ctx, x, y, height, color, nodeRadius) {
        // Draw the vertical bracket line
        ctx.strokeStyle = color;
        ctx.lineWidth = 1; // Thickness of the bracket line
        ctx.beginPath();
        ctx.moveTo(x, y); // Start point
        ctx.lineTo(x, y + height); // End point
        ctx.stroke();
    
        // Draw the top node
        const gradientTop = ctx.createRadialGradient(x, y, 1, x, y, nodeRadius);
        gradientTop.addColorStop(0, 'rgba(74, 39, 39, 0.7)');
        gradientTop.addColorStop(1, 'rgba(74, 39, 39, 0.7)');
        ctx.fillStyle = gradientTop;
        ctx.beginPath();
        ctx.arc(x, y, nodeRadius, 0, Math.PI * 2);
        ctx.fill();
    
        // Draw the bottom node
        const gradientBottom = ctx.createRadialGradient(
        x,
        y + height,
        1,
        x,
        y + height,
        nodeRadius
        );
        gradientBottom.addColorStop(0, 'rgba(223, 213, 30, 0)');
        gradientBottom.addColorStop(1, 'rgba(74, 39, 39, 0)');
        ctx.fillStyle = gradientBottom;
        ctx.beginPath();
        ctx.arc(x, y + height, nodeRadius, 0, Math.PI * 2);
        ctx.fill();
    }

    applyGrainyFilter = (ctx, width, height, alpha = 0.03) => {
        // Create a grainy noise effect
        const grainCanvas = createCanvas(width, height);
        const grainCtx = grainCanvas.getContext('2d');
    
        for (let x = 0; x < width; x++) {
        for (let y = 0; y < height; y++) {
            if (Math.random() > 0.97) { // Sparse noise dots
            const gray = Math.random() * 255; // Random gray color
            grainCtx.fillStyle = `rgba(${gray}, ${gray}, ${gray}, ${alpha})`;
            grainCtx.fillRect(x, y, 1, 1); // Draw a small noise dot
            }
        }
        }
    
        // Apply the noise as an overlay
        ctx.drawImage(grainCanvas, 0, 0);
    };
  
    async drawUserAvatar(ctx, userImageBuffer) {
        const userImage = await loadImage(userImageBuffer);
        const avatarX = 190;
        const avatarY = 350;
        ctx.save();
        ctx.beginPath();
        ctx.arc(avatarX + 45, avatarY + 65, 45, 0, Math.PI * 2, true);
        ctx.closePath();
        ctx.clip();
        ctx.drawImage(userImage, avatarX, avatarY, 90, 90);
        ctx.restore();
    }
    
    drawCatRobotSilhouette(ctx) {
        const x = 200;
        const y = 390;
        const scale = 0.38; // Reduce size by X%
    
        ctx.fillStyle = '#FFD700'; // Yellow color for the silhouette
        ctx.beginPath();
        ctx.moveTo(x + 20 * scale, y); // Start from the top left of the head
        ctx.lineTo(x + 60 * scale, y - 40 * scale); // Left ear tip
        ctx.lineTo(x + 100 * scale, y); // Top of the head
        ctx.lineTo(x + 140 * scale, y - 40 * scale); // Right ear tip
        ctx.lineTo(x + 180 * scale, y); // Top right of the head
        ctx.lineTo(x + 160 * scale, y + 100 * scale); // Right shoulder
        ctx.lineTo(x + 20 * scale, y + 100 * scale); // Left shoulder
        ctx.closePath();
        ctx.fill();
    
        // Draw eyes
        ctx.fillStyle = '#FF0000'; // Red color for eyes
        ctx.beginPath();
        ctx.arc(x + 60 * scale, y + 20 * scale, 10 * scale, 0, Math.PI * 2, true); // Left eye
        ctx.arc(x + 120 * scale, y + 20 * scale, 10 * scale, 0, Math.PI * 2, true); // Right eye
        ctx.fill();
    
        // Draw nose
        ctx.fillStyle = '#000000'; // Black color for nose
        ctx.beginPath();
        ctx.moveTo(x + 90 * scale, y + 40 * scale);
        ctx.lineTo(x + 80 * scale, y + 60 * scale);
        ctx.lineTo(x + 100 * scale, y + 60 * scale);
        ctx.closePath();
        ctx.fill();
    
        // Draw whiskers
        ctx.strokeStyle = '#000000'; // Black color for whiskers
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x + 40 * scale, y + 40 * scale);
        ctx.lineTo(x + 10 * scale, y + 40 * scale); // Left whisker 1
        ctx.moveTo(x + 40 * scale, y + 50 * scale);
        ctx.lineTo(x + 10 * scale, y + 50 * scale); // Left whisker 2
        ctx.moveTo(x + 140 * scale, y + 40 * scale);
        ctx.lineTo(x + 170 * scale, y + 40 * scale); // Right whisker 1
        ctx.moveTo(x + 140 * scale, y + 50 * scale);
        ctx.lineTo(x + 170 * scale, y + 50 * scale); // Right whisker 2
        ctx.stroke();
    
        // Draw "KATZ!" text on chest
        ctx.font = '15px "SF Toontime"';
        ctx.fillStyle = 'red';
        ctx.fillText('KATZ!', x + 35 * scale, y + 90 * scale);
    }
    
    drawBackground(ctx, canvas) {
        const canvasGradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
        canvasGradient.addColorStop(0, '#2a0a0a');
        canvasGradient.addColorStop(1, '#000000');
        ctx.fillStyle = canvasGradient;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    
    async drawLogoAndTitle(ctx, logoBuffer) {
        const logoX = 270;
        const logoY = 100;
    
        ctx.save();
        ctx.beginPath();
        ctx.arc(logoX + 100, logoY + 100, 100, 0, Math.PI * 2, true);
        ctx.closePath();
        ctx.clip();
    
        const logoImage = await loadImage(logoBuffer);
        ctx.drawImage(logoImage, logoX, logoY, 200, 200);
        ctx.restore();
    
        // Draw tilted Title text
        function drawTiltedText(ctx, text, x, y, font, fillStyle, textAlign, skewX = 0, skewY = 0) {
        ctx.save();
        ctx.font = font;
        ctx.fillStyle = fillStyle;
        ctx.textAlign = textAlign;
        ctx.transform(1, skewY, skewX, 1, 0, 0); // Apply tilt/skew
        ctx.fillText(text, x, y);
        ctx.restore();
        }
        // "KATZ!" in Toontime Bold
        drawTiltedText(ctx, 'KATZ!', 500, 180, 'bold 42px "SF Toontime"', 'azure', 'center', 0.05, 0);
    
        // "memes" in italic Toontime Bold
        drawTiltedText(ctx, 'memes', 280, 210, 'italic 20px "SF Toontime"', 'rgba(212, 212, 212, 0.7)', 'center', -0.03, 0);
    
        // "Autonomous Trench Agent..." slogan in italic Toontime Bold
    // drawTiltedText(ctx, 'Autonomous Trench Agent...', 405, 300, 'italic 19px "SF Toontime"', '#666', 'center', 0.02, 0);
    
        // Cartoon Skew Effect for "KATZ!"
        drawTiltedText(ctx, 'KATZ!', 490, 200, 'bold 45px "SF Toontime"', 'azure', 'center', -0.3, 0);
    
        // Cartoon Skew Effect for "memes"
        drawTiltedText(ctx, 'memes', 280, 210, 'italic 18px "SF Toontime"', '#b09a9a', 'center', 0.1, 0.2);
    
        // Standard Text for Slogan (no skew)
        //drawTiltedText(ctx, 'Autonomous Trench Agent...', 400, 305, 'italic 20px "SF Toontime"', '#ddd', 'center');
    }
    
    drawUserInfo(ctx, user) {
        const avatarContainerY = 350;
        ctx.font = 'italic 21px "SF Toontime"';
        ctx.fillStyle = '#b0b0b0';
        ctx.fillText('anon@:', 290, avatarContainerY + 50);
    
        ctx.font = 'bold 21px "SF Toontime"';
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'left';
        ctx.fillText(user.username || 'Not set', 290, avatarContainerY + 80);
    
        const registrationContainerY = avatarContainerY + 150;
        ctx.font = 'bold 21px "SF Toontime"';
        ctx.fillStyle = 'rgba(0, 255, 0, 0.7)';
        ctx.textAlign = 'center';
        ctx.fillText(`Registered: ${new Date(user.registeredAt).toLocaleDateString()}`, 430, registrationContainerY + 40);
    
        // Green tick
        ctx.strokeStyle = 'rgba(0, 255, 0, 0.7)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(200, registrationContainerY + 50);
        ctx.lineTo(220, registrationContainerY + 70);
        ctx.lineTo(260, registrationContainerY + 30);
        ctx.stroke();
    
        ctx.fillStyle = '#ffffff';
        ctx.fillText(`User ID: ${user.telegramId}`, 420, registrationContainerY + 80);
    
        // Draw registration container cut out
        drawHandDrawnContainer(ctx, 150, registrationContainerY, 500, 120);
        return registrationContainerY;
    }
    
    async handleProfileCommand(bot, chatId, userInfo) {
    
        try {
        // Fetch user data
        const db = getDatabase();
        const usersCollection = db.collection('users');
        const user = await usersCollection.findOne({ telegramId: userInfo.id.toString() });
    
        if (!user) {
            await bot.sendMessage(chatId, '❌ Profile not found. Please use /start to register first.', {
            reply_markup: {
                inline_keyboard: [[{ text: '🚀 Get Started', callback_data: 'start_command' }]],
            },
            });
            return;
        }
    
        // Wallet counts
        const walletCounts = {
            ethereum: user.wallets?.ethereum?.length || 0,
            base: user.wallets?.base?.length || 0,
            solana: user.wallets?.solana?.length || 0,
        };
        const totalWallets = Object.values(walletCounts).reduce((a, b) => a + b, 0);
    
        // Fetch profile photo with enhanced error handling
        let userImageBuffer = null;
        let userHasProfilePicture = false;
    
        try {
            const profilePhotos = await bot.getUserProfilePhotos(userInfo.id);
    
            if (profilePhotos.total_count > 0) {
            const fileId = profilePhotos.photos[0][0].file_id;
            const file = await bot.getFile(fileId);
            const fileUrl = `https://api.telegram.org/file/bot${bot.token}/${file.file_path}`;
    
            try {
                const response = await axios.get(fileUrl, { responseType: 'arraybuffer' });
                userImageBuffer = Buffer.from(response.data);
                userHasProfilePicture = true;
            } catch (error) {
                console.error('Failed to fetch user profile photo from URL:', error.message);
                userImageBuffer = null;
                userHasProfilePicture = false;
            }
            }
        } catch (error) {
            console.error('Failed to retrieve user profile photos:', error.message);
            userImageBuffer = null;
            userHasProfilePicture = false;
        }
    
        // Load logo image
        const logoPath = path.resolve(__dirname, '../../assets/images/logo.png');
        if (!fs.existsSync(logoPath)) {
            throw new Error(`Logo not found at: ${logoPath}`);
        }
        const logoBuffer = fs.readFileSync(logoPath);
    
        // Prepare canvas
        const canvas = createCanvas(800, 1250);
        const ctx = canvas.getContext('2d');
    
        // Draw Background
        drawBackground(ctx, canvas);
    
        /* Draw Zigzag border on canvas
        ctx.strokeStyle = '#880000';
        ctx.lineWidth = 3;
        ctx.beginPath();
        for (let i = 30; i < canvas.width - 30; i += 20) {
            const y = i % 40 === 0 ? 35 : 25;
            ctx.lineTo(i, y);
        }
        for (let i = 30; i < canvas.height - 30; i += 20) {
            const x = i % 40 === 0 ? canvas.width - 35 : canvas.width - 25;
            ctx.lineTo(x, i);
        }
        for (let i = canvas.width - 30; i > 30; i -= 20) {
            const y = i % 40 === 0 ? canvas.height - 35 : canvas.height - 25;
            ctx.lineTo(i, y);
        }
        for (let i = canvas.height - 30; i > 30; i -= 20) {
            const x = i % 40 === 0 ? 35 : 25;
            ctx.lineTo(x, i);
        }
        ctx.closePath();
        ctx.stroke();
        */
    
        // Draw Logo and Title
        await drawLogoAndTitle(ctx, logoBuffer);
    
        // Draw Username & User Avatar Container
        const avatarContainerY = 355;
        // drawHandDrawnContainer(ctx, 175, avatarContainerY, 480, 110);
    
        // Draw User Avatar or Cat Robot Silhouette
        if (userHasProfilePicture) {
            await drawUserAvatar(ctx, userImageBuffer);
        } else {
            drawCatRobotSilhouette(ctx);
        }
    
        // Draw user info text
        const registrationContainerY = drawUserInfo(ctx, user);
    
        // Wallet Overview Info Container
        const walletContainerY = registrationContainerY + 170;
        const containerX = 150; // X-coordinate for the container
        const containerWidth = 500; // Width of the container
        const containerHeight = 250; // Height of the container
    
        // Semi-transparent background with matching shape
        const gradient = ctx.createLinearGradient(
            containerX,
            walletContainerY,
            containerX + containerWidth,
            walletContainerY + containerHeight
        );
        gradient.addColorStop(0, 'rgba(102, 42, 10, 0.3)'); // Dark red
        gradient.addColorStop(1, 'rgba(0, 0, 0, 0.3)'); // Black
        ctx.fillStyle = gradient;
    
        // Wallet Background fillin - Replicate the "hand-drawn" logic
        ctx.beginPath();
        ctx.moveTo(containerX + 20, walletContainerY);
        ctx.lineTo(containerX + containerWidth - 20, walletContainerY + 10);
        ctx.lineTo(containerX + containerWidth, walletContainerY + containerHeight - 20);
        ctx.lineTo(containerX + 10, walletContainerY + containerHeight);
        ctx.lineTo(containerX - 20, walletContainerY + containerHeight - 10);
        ctx.closePath();
        ctx.fill();
    
        // Draw the hand-drawn container (outline)
        drawHandDrawnContainer(ctx, containerX, walletContainerY, containerWidth, containerHeight);
    
        // Wallet overview text
        ctx.font = 'bold 22px "SF Toontime"';
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'center';
        ctx.fillText('Wallet Overview:', 400, walletContainerY + 80);
    
        // Curved and tapered yellow line
        ctx.save(); // Save current canvas state, be wise
        ctx.strokeStyle = 'yellow';
    
        // Define the gradient for the wavy line
        const waveyGradient = ctx.createLinearGradient(310, walletContainerY + 40, 430, walletContainerY + 50);
        waveyGradient.addColorStop(0, 'rgba(255, 255, 0, 0.8)');
        waveyGradient.addColorStop(1, 'rgba(255, 255, 0, 0.4)');
        ctx.strokeStyle = waveyGradient;
    
        ctx.beginPath();
        ctx.moveTo(310, walletContainerY + 50);
        ctx.bezierCurveTo(340, walletContainerY + 30, 370, walletContainerY + 70, 400, walletContainerY + 50);
        ctx.bezierCurveTo(420, walletContainerY + 30, 450, walletContainerY + 70, 480, walletContainerY + 50);
    
        ctx.lineWidth = 1.6;
        ctx.lineCap = 'round';
        ctx.stroke();
        ctx.restore();
    
        // Brackets
        const x = 180;
        const y = 420;
        const width = 400;
        const height = 150;
    
        const rightBracketOffset = 0; // x-axis adjust
        const downOffset = 150; // y-axis adjust
    
        ctx.strokeStyle = '#555';
        ctx.lineWidth = 1.5;
    
        // Left Bracket
        ctx.beginPath();
        ctx.moveTo(x + 40, y + 30 + downOffset);
        ctx.lineTo(x + 40, y + height - 20 + downOffset);
        ctx.stroke();
    
        const leftBudX = x + 40; // X-coordinate for left bud
        const leftBudY = y + height - 20 + downOffset; // Y-coordinate for left bud
        drawMetallicBud(ctx, leftBudX, leftBudY, 'rgb(255, 255, 0)'); // Deep yellow for the left node
    
        // Right Bracket
        ctx.beginPath();
        ctx.moveTo(x + width - 10 - rightBracketOffset, y + 20 + downOffset);
        ctx.lineTo(x + width - 10 - rightBracketOffset, y + height - 20 + downOffset);
        ctx.stroke();
    
        const rightBudX = x + width - 10 - rightBracketOffset; // X-coordinate for right bud
        const rightBudY = y + height - 20 + downOffset; // Y-coordinate for right bud
        drawMetallicBud(ctx, rightBudX, rightBudY, 'rgb(255, 255, 0)'); // Metallic gray for the right node
    
        // Wallet Summary
        ctx.font = 'bold 21px "SF Toontime"';    
        ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
        ctx.fillText(`Ethereum: ${walletCounts.ethereum}`, 400, walletContainerY + 130);
        ctx.fillText(`Base: ${walletCounts.base}`, 400, walletContainerY + 150);
        ctx.fillText(`Solana: ${walletCounts.solana}`, 400, walletContainerY + 170);    
        ctx.font = 'italic 21px "SF Toontime"';
        ctx.fillStyle = 'rgba(0, 255, 0, 0.7)';
        ctx.fillText('Autonomous: true', 400, walletContainerY + 210);
    
        // Certificate Issuance Timestamp
        // + Helmet/KAT-marine Icon
        const options = {day: '2-digit',month: 'short',hour: '2-digit',minute: '2-digit',hour12: false};
        const timestamp = `${new Date().toLocaleString('en-US', options)}`;
        
        const helmetIconPath = path.resolve(__dirname, '../../assets/images/helmet.png'); 
        await drawTimestampWithHelmet(ctx, timestamp, helmetIconPath, 345, 980); // Coordinates at the bottom right    
    
        // Claw signature
        const clawX = 420, clawY = walletContainerY + 290, clawSize = 8, verticalOffset = 0;
        // Claw scratch offsets for realistic effect
        const scratchOffsets = [-20, -5, 10, 20];
    
        scratchOffsets.forEach((offset) => {
            // Create a gradient for fading effect
            const gradient = ctx.createLinearGradient(
            clawX + offset, 
            clawY - clawSize * 2 + verticalOffset,  // Reduced from clawSize * 4
            clawX + offset, 
            clawY + clawSize * 3 + verticalOffset   // Reduced from clawSize * 5
            );
            gradient.addColorStop(0, 'rgba(255, 65, 65, 0)'); // Transparent at the top
            gradient.addColorStop(0.2, '#FF0000'); // Bright red towards the top-middle
            gradient.addColorStop(0.8, '#FF0000'); // Bright red towards the bottom-middle
            gradient.addColorStop(1, 'rgba(255, 65, 65, 0)'); // Transparent at the bottom
    
            ctx.shadowColor = 'rgba(255, 0, 0, 0.5)';
            ctx.shadowBlur = 15;
    
            ctx.strokeStyle = gradient;
            ctx.lineWidth = 3;
    
            ctx.beginPath();
            const startX = clawX + offset;
            const startY = clawY - clawSize * 2 + verticalOffset;  // Reduced vertical start
            const endY = clawY + clawSize * 3 + verticalOffset;    // Reduced vertical end
    
            ctx.moveTo(startX, startY);
            for (let i = startY; i < endY; i += clawSize / 2) {    // Smaller steps for better jagged effect
            const variation = (Math.random() * clawSize * 0.6) - clawSize * 0.2; // Random variation for jagged effect
            ctx.lineTo(startX + variation, i + clawSize / 2);
            }
    
            ctx.stroke();
            ctx.closePath();
    
            // Draw a wider middle section for each scratch
            ctx.lineWidth = 4; // Thicker line for the middle section
            ctx.beginPath();
            ctx.moveTo(startX, startY + (endY - startY) * 0.3);
            ctx.lineTo(startX, startY + (endY - startY) * 0.7);
            ctx.stroke();
            ctx.closePath();
        });
    
        // Reset shadow properties to avoid affecting other elements
        ctx.shadowColor = 'transparent';
        ctx.shadowBlur = 0;
    
        // Yellow text under the claw mark
        ctx.shadowBlur = 20;
        ctx.shadowColor = 'rgba(255, 255, 0, 0.8)';
        ctx.font = 'italic 14px "SF Toontime"';
        ctx.fillStyle = 'yellow';
        ctx.fillText('Meme Trechor Level 1: Square up anon...', 250, clawY + 70 + verticalOffset);
        ctx.fill();
    
        // Apply the grainy filter to the entire canvas
        applyGrainyFilter(ctx, canvas.width, canvas.height, 0.1); // Subtle gray noise
    
        // Export canvas to file
        const certificatePath = path.resolve(__dirname, '../../temp/certificate.png');
        const buffer = canvas.toBuffer('image/png');
        fs.writeFileSync(certificatePath, buffer);
    
        // Send the certificate
        await bot.sendChatAction(chatId, 'upload_photo');
        await bot.sendPhoto(chatId, certificatePath);
    
        // Clean up
        if (fs.existsSync(certificatePath)) {
            fs.unlinkSync(certificatePath);
        }
        } catch (error) {
        console.error('Error in handleProfileCommand:', error);
        await bot.sendMessage(chatId, '❌ An error occurred. Please try again later.', {
            reply_markup: {
            inline_keyboard: [[{ text: '🔄 Retry', callback_data: 'retry_profile' }]],
            },
        });
        }
    }
}  