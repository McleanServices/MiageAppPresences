const sql = require('mssql');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const { pool, poolConnect } = require('./db');

// UUID-based Secure QR Code System
// QR codes now contain only a UUID that maps to session data in the database

/**
 * Generate a secure UUID-based QR code
 * The QR code will contain only a UUID, not session information
 */
const generateSecureQRCode = async (req, res) => {
  const { 
    id_seance, 
    id_plage, 
    full_seance_mode = false,
    expires_in_minutes = 60,
    location_coords = null
  } = req.body;

  // Security check: Only teachers can generate QR codes
  if (req.user.type_utilisateur !== 'enseignant' && req.user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      message: 'Seuls les enseignants peuvent générer des codes QR'
    });
  }

  if (!id_seance) {
    return res.status(400).json({
      success: false,
      message: 'id_seance est requis'
    });
  }

  try {
    await poolConnect;

    // Verify session exists and teacher has permission
    const sessionCheck = await pool.request()
      .input('id_seance', parseInt(id_seance))
      .input('id_enseignant', req.user.id)
      .query(`
        SELECT s.*, c.nom as cours_nom
        FROM Seance s
        INNER JOIN Cours c ON s.id_cours = c.id_cours
        INNER JOIN Enseignement ens ON c.id_cours = ens.id_cours
        WHERE s.id_seance = @id_seance 
        AND (ens.id_enseignant = @id_enseignant OR @id_enseignant IN (
          SELECT a.id_admin FROM Administrateur a WHERE a.actif_admin = 1
        ))
      `);

    if (sessionCheck.recordset.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Séance non trouvée ou accès non autorisé'
      });
    }

    const seance = sessionCheck.recordset[0];

    // Check if session is locked
    if (seance.est_figee) {
      return res.status(400).json({
        success: false,
        message: 'La séance est figée, impossible de générer un QR code'
      });
    }

    // Get plages for this session
    let plagesQuery = `
      SELECT id_plage, heure_debut, heure_fin
      FROM PlageHoraire
      WHERE id_seance = @id_seance
    `;

    if (!full_seance_mode && id_plage) {
      plagesQuery += ' AND id_plage = @id_plage';
    }

    plagesQuery += ' ORDER BY heure_debut';

    const plagesRequest = pool.request().input('id_seance', parseInt(id_seance));
    if (!full_seance_mode && id_plage) {
      plagesRequest.input('id_plage', parseInt(id_plage));
    }

    const plagesResult = await plagesRequest.query(plagesQuery);

    if (plagesResult.recordset.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Aucune plage horaire trouvée pour cette séance'
      });
    }

    // Generate UUID-based QR codes
    const qrCodes = [];
    const timestamp = new Date();
    const expiresAt = new Date(timestamp.getTime() + (expires_in_minutes * 60 * 1000));

    for (const plage of plagesResult.recordset) {
      // Generate a unique UUID for this QR code
      const qrUuid = uuidv4();
      
      // Create security checksum
      const checksum = crypto.createHash('sha256')
        .update(`${id_seance}-${plage.id_plage}-${req.user.id}-${qrUuid}-${timestamp.getTime()}`)
        .digest('hex');

      // Prepare metadata
      const metadata = {
        generated_ip: req.ip,
        user_agent: req.get('User-Agent'),
        location_coords: location_coords,
        security_level: 'high'
      };

      // Store UUID mapping in database
      await pool.request()
        .input('uuid', qrUuid)
        .input('id_seance', parseInt(id_seance))
        .input('id_plage', full_seance_mode ? null : plage.id_plage)
        .input('id_enseignant', req.user.id)
        .input('full_seance_mode', full_seance_mode)
        .input('expires_at', expiresAt)
        .input('checksum', checksum)
        .input('metadata', JSON.stringify(metadata))
        .query(`
          INSERT INTO QRCodeUUID (
            uuid, id_seance, id_plage, id_enseignant, 
            full_seance_mode, expires_at, checksum, metadata
          ) VALUES (
            @uuid, @id_seance, @id_plage, @id_enseignant,
            @full_seance_mode, @expires_at, @checksum, @metadata
          )
        `);

      qrCodes.push({
        uuid: qrUuid,
        id_plage: plage.id_plage,
        heure_debut: plage.heure_debut,
        heure_fin: plage.heure_fin,
        expires_at: expiresAt.toISOString(),
        // QR data now contains only the UUID
        qr_data: qrUuid
      });

      // If full seance mode, generate only one QR for all plages
      if (full_seance_mode) break;
    }

    res.status(200).json({
      success: true,
      message: 'Codes QR sécurisés générés avec succès',
      data: {
        seance: {
          id_seance: seance.id_seance,
          cours_nom: seance.cours_nom,
          date: seance.date,
          heure_debut: seance.heure_debut,
          heure_fin: seance.heure_fin
        },
        full_seance_mode: full_seance_mode,
        expires_in_minutes: expires_in_minutes,
        generated_at: timestamp.toISOString(),
        qr_codes: qrCodes
      }
    });

  } catch (err) {
    console.error('Error generating secure QR codes:', err);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur lors de la génération des codes QR sécurisés',
      error: err.message
    });
  }
};

/**
 * Validate UUID-based QR code and record presence
 * The client sends only the UUID and user ID
 */
const validateSecureQRCode = async (req, res) => {
  const { uuid, id_utilisateur, location_coords = null } = req.body;

  console.log('🔍 [SECURE QR VALIDATION] Starting validation...');
  console.log('📋 Request body:', req.body);
  console.log('🔑 UUID:', uuid);
  console.log('👤 User ID:', id_utilisateur);
  console.log('📍 Location:', location_coords);

  if (!uuid || !id_utilisateur) {
    console.log('❌ [VALIDATION ERROR] Missing required parameters');
    return res.status(400).json({
      success: false,
      message: 'UUID et id_utilisateur sont requis'
    });
  }

  try {
    await poolConnect;
    console.log('✅ [DATABASE] Connected successfully');

    // Log the usage attempt
    const logUsageAttempt = async (success, errorMessage = null) => {
      try {
        await pool.request()
          .input('uuid', uuid)
          .input('id_utilisateur', parseInt(id_utilisateur))
          .input('success', success)
          .input('error_message', errorMessage)
          .input('ip_address', req.ip)
          .input('user_agent', req.get('User-Agent'))
          .query(`
            INSERT INTO QRCodeUsageLog (
              uuid, id_utilisateur, success, error_message, ip_address, user_agent
            ) VALUES (
              @uuid, @id_utilisateur, @success, @error_message, @ip_address, @user_agent
            )
          `);
      } catch (logErr) {
        console.error('Error logging QR usage attempt:', logErr);
      }
    };

    // Look up the QR code by UUID
    console.log('🔍 [DATABASE] Looking up UUID in database...');
    const qrResult = await pool.request()
      .input('uuid', uuid)
      .query(`
        SELECT 
          q.*,
          s.est_figee,
          s.statut as seance_statut,
          s.date as seance_date,
          p.heure_debut as plage_heure_debut,
          p.heure_fin as plage_heure_fin
        FROM QRCodeUUID q
        INNER JOIN Seance s ON q.id_seance = s.id_seance
        LEFT JOIN PlageHoraire p ON q.id_plage = p.id_plage
        WHERE q.uuid = @uuid AND q.is_active = 1
      `);

    console.log('📊 [DATABASE] QR lookup result count:', qrResult.recordset.length);
    if (qrResult.recordset.length > 0) {
      console.log('📋 [DATABASE] Found QR data:', {
        uuid: qrResult.recordset[0].uuid,
        id_seance: qrResult.recordset[0].id_seance,
        id_plage: qrResult.recordset[0].id_plage,
        expires_at: qrResult.recordset[0].expires_at,
        is_used: qrResult.recordset[0].is_used,
        is_active: qrResult.recordset[0].is_active
      });
    }

    if (qrResult.recordset.length === 0) {
      console.log('❌ [VALIDATION ERROR] UUID not found in database');
      await logUsageAttempt(false, 'UUID QR code not found');
      return res.status(404).json({
        success: false,
        message: 'Code QR invalide ou expiré'
      });
    }

    const qrData = qrResult.recordset[0];

    // Check if QR code has expired
    if (new Date() > new Date(qrData.expires_at)) {
      await logUsageAttempt(false, 'QR code expired');
      return res.status(400).json({
        success: false,
        message: 'Code QR expiré'
      });
    }

    // Check if QR code has already been used (one-time use)
    if (qrData.is_used) {
      await logUsageAttempt(false, 'QR code already used');
      return res.status(400).json({
        success: false,
        message: 'Code QR déjà utilisé'
      });
    }

    // Check if session is locked
    if (qrData.est_figee) {
      await logUsageAttempt(false, 'Session is locked');
      return res.status(400).json({
        success: false,
        message: 'La séance est figée, impossible d\'enregistrer la présence'
      });
    }

    // Verify user exists and is a student
    const userCheck = await pool.request()
      .input('id_utilisateur', parseInt(id_utilisateur))
      .query(`
        SELECT type_utilisateur, nom, prenom 
        FROM Utilisateur 
        WHERE id_utilisateur = @id_utilisateur AND statut_actif = 1
      `);

    if (userCheck.recordset.length === 0) {
      await logUsageAttempt(false, 'User not found or inactive');
      return res.status(404).json({
        success: false,
        message: 'Utilisateur non trouvé ou inactif'
      });
    }

    const user = userCheck.recordset[0];

    if (user.type_utilisateur !== 'etudiant') {
      await logUsageAttempt(false, 'User is not a student');
      return res.status(403).json({
        success: false,
        message: 'Seuls les étudiants peuvent scanner les codes QR de présence'
      });
    }

    // Record presence using the presence module
    const presences = require('./presences');
    
    const presenceData = {
      id_utilisateur: parseInt(id_utilisateur),
      id_plage: qrData.id_plage,
      etat: 'present',
      mode_emargement: 'qr_uuid',
      etablie_par_enseignant: false,
      full_seance_mode: qrData.full_seance_mode
    };

    // Simulate request object for presence recording
    const mockReq = {
      body: presenceData,
      user: { id: qrData.id_enseignant }
    };

    // Record the presence
    const recordResult = await new Promise((resolve, reject) => {
      const mockRes = {
        status: (code) => ({
          json: (data) => {
            if (code >= 200 && code < 300) {
              resolve(data);
            } else {
              reject(new Error(data.message || 'Error recording presence'));
            }
          }
        })
      };

      presences.recordPresence(mockReq, mockRes);
    });

    // Mark QR code as used
    await pool.request()
      .input('uuid', uuid)
      .input('used_by', parseInt(id_utilisateur))
      .query(`
        UPDATE QRCodeUUID 
        SET is_used = 1, used_at = GETDATE(), used_by = @used_by 
        WHERE uuid = @uuid
      `);

    // Log successful usage
    await logUsageAttempt(true);

    res.status(200).json({
      success: true,
      message: 'QR code validé et présence enregistrée avec succès',
      data: {
        user: {
          nom: user.nom,
          prenom: user.prenom
        },
        session_info: {
          id_seance: qrData.id_seance,
          id_plage: qrData.id_plage,
          full_seance_mode: qrData.full_seance_mode
        },
        presence_result: recordResult
      }
    });

  } catch (err) {
    console.error('💥 [CRITICAL ERROR] Error validating secure QR code:', err);
    console.error('🔍 [ERROR DETAILS] Stack trace:', err.stack);
    
    // Log the error attempt
    try {
      await pool.request()
        .input('uuid', uuid)
        .input('id_utilisateur', parseInt(id_utilisateur))
        .input('success', false)
        .input('error_message', err.message)
        .input('ip_address', req.ip)
        .input('user_agent', req.get('User-Agent'))
        .query(`
          INSERT INTO QRCodeUsageLog (
            uuid, id_utilisateur, success, error_message, ip_address, user_agent
          ) VALUES (
            @uuid, @id_utilisateur, @success, @error_message, @ip_address, @user_agent
          )
        `);
    } catch (logErr) {
      console.error('Error logging failed QR validation:', logErr);
    }

    res.status(500).json({
      success: false,
      message: 'Erreur serveur lors de la validation du code QR',
      error: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error'
    });
  }
};

/**
 * Get QR code information by UUID (for debugging/admin purposes)
 */
const getQRCodeInfo = async (req, res) => {
  const { uuid } = req.params;

  // Security check: Only teachers and admins can access QR info
  if (req.user.type_utilisateur !== 'enseignant' && req.user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      message: 'Accès refusé'
    });
  }

  try {
    await poolConnect;

    const qrInfo = await pool.request()
      .input('uuid', uuid)
      .query(`
        SELECT 
          q.*,
          s.date as seance_date,
          c.nom as cours_nom,
          u.nom as enseignant_nom,
          u.prenom as enseignant_prenom,
          p.heure_debut as plage_heure_debut,
          p.heure_fin as plage_heure_fin,
          ub.nom as used_by_nom,
          ub.prenom as used_by_prenom
        FROM QRCodeUUID q
        INNER JOIN Seance s ON q.id_seance = s.id_seance
        INNER JOIN Cours c ON s.id_cours = c.id_cours
        INNER JOIN Utilisateur u ON q.id_enseignant = u.id_utilisateur
        LEFT JOIN PlageHoraire p ON q.id_plage = p.id_plage
        LEFT JOIN Utilisateur ub ON q.used_by = ub.id_utilisateur
        WHERE q.uuid = @uuid
      `);

    if (qrInfo.recordset.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Code QR non trouvé'
      });
    }

    const qr = qrInfo.recordset[0];

    res.status(200).json({
      success: true,
      data: {
        uuid: qr.uuid,
        seance: {
          id_seance: qr.id_seance,
          cours_nom: qr.cours_nom,
          date: qr.seance_date
        },
        plage: qr.id_plage ? {
          id_plage: qr.id_plage,
          heure_debut: qr.plage_heure_debut,
          heure_fin: qr.plage_heure_fin
        } : null,
        enseignant: {
          nom: qr.enseignant_nom,
          prenom: qr.enseignant_prenom
        },
        full_seance_mode: qr.full_seance_mode,
        generated_at: qr.generated_at,
        expires_at: qr.expires_at,
        is_used: qr.is_used,
        used_at: qr.used_at,
        used_by: qr.used_by ? {
          nom: qr.used_by_nom,
          prenom: qr.used_by_prenom
        } : null,
        is_active: qr.is_active,
        metadata: qr.metadata ? JSON.parse(qr.metadata) : null
      }
    });

  } catch (err) {
    console.error('Error getting QR code info:', err);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur lors de la récupération des informations du code QR',
      error: err.message
    });
  }
};

/**
 * Clean up expired QR codes (maintenance endpoint)
 */
const cleanupExpiredQRCodes = async (req, res) => {
  // Security check: Only admins can perform maintenance
  if (req.user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      message: 'Seuls les administrateurs peuvent effectuer la maintenance'
    });
  }

  try {
    await poolConnect;

    const result = await pool.request().query(`
      UPDATE QRCodeUUID 
      SET is_active = 0 
      WHERE expires_at < GETDATE() AND is_active = 1;
      
      SELECT @@ROWCOUNT as cleaned_count;
    `);

    const cleanedCount = result.recordset[0].cleaned_count;

    res.status(200).json({
      success: true,
      message: `${cleanedCount} codes QR expirés nettoyés`,
      data: {
        cleaned_count: cleanedCount
      }
    });

  } catch (err) {
    console.error('Error cleaning up expired QR codes:', err);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur lors du nettoyage des codes QR expirés',
      error: err.message
    });
  }
};

module.exports = {
  generateSecureQRCode,
  validateSecureQRCode,
  getQRCodeInfo,
  cleanupExpiredQRCodes
};
