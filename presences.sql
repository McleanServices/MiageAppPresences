
-- Table: Utilisateur
CREATE TABLE Utilisateur (
    id_utilisateur INT IDENTITY(1,1) PRIMARY KEY,
    nom NVARCHAR(100),
    prenom NVARCHAR(100),
    email NVARCHAR(255) UNIQUE,
    date_creation DATETIME,
    statut_actif BIT,
    derniere_connexion DATETIME,
    type_utilisateur NVARCHAR(50),
    role NVARCHAR(50)
);

-- Table: Etudiant
CREATE TABLE Etudiant (
    id_utilisateur INT PRIMARY KEY,
    numero_etudiant NVARCHAR(50),
    annee_universitaire NVARCHAR(20),
    statut_inscription NVARCHAR(50),
    FOREIGN KEY (id_utilisateur) REFERENCES Utilisateur(id_utilisateur)
);

-- Table: Enseignant
CREATE TABLE Enseignant (
    id_utilisateur INT PRIMARY KEY,
    matricule_enseignant NVARCHAR(50),
    type_contrat NVARCHAR(50),
    matiere_principale NVARCHAR(100),
    peut_valider_presence BIT,
    notification_absence_active BIT,
    FOREIGN KEY (id_utilisateur) REFERENCES Utilisateur(id_utilisateur)
);

-- Table: Greta
CREATE TABLE Greta (
    id_utilisateur INT PRIMARY KEY,
    structure NVARCHAR(100),
    type_export NVARCHAR(50),
    frequence_export NVARCHAR(50),
    referent NVARCHAR(100),
    notifications_active BIT,
    FOREIGN KEY (id_utilisateur) REFERENCES Utilisateur(id_utilisateur)
);

-- Table: Administrateur
CREATE TABLE Administrateur (
    id_admin INT PRIMARY KEY,
    niveau_admin NVARCHAR(50),
    peut_modifier_apres_validation BIT,
    droit_export_donnees BIT,
    date_nomination_admin DATE,
    actif_admin BIT,
    FOREIGN KEY (id_admin) REFERENCES Enseignant(id_utilisateur)
);

-- Table: Cours
CREATE TABLE Cours (
    id_cours INT IDENTITY(1,1) PRIMARY KEY,
    nom NVARCHAR(100),
    description NVARCHAR(255)
);

-- Table: Enseignement
CREATE TABLE Enseignement (
    id_enseignant INT,
    id_cours INT,
    role_dans_le_cours NVARCHAR(100),
    PRIMARY KEY (id_enseignant, id_cours),
    FOREIGN KEY (id_enseignant) REFERENCES Enseignant(id_utilisateur),
    FOREIGN KEY (id_cours) REFERENCES Cours(id_cours)
);

-- Table: Seance
CREATE TABLE Seance (
    id_seance INT IDENTITY(1,1) PRIMARY KEY,
    id_cours INT,
    date DATE,
    heure_debut TIME,
    heure_fin TIME,
    statut NVARCHAR(50),
    est_figee BIT,
    FOREIGN KEY (id_cours) REFERENCES Cours(id_cours)
);

-- Table: PlageHoraire
CREATE TABLE PlageHoraire (
    id_plage INT IDENTITY(1,1) PRIMARY KEY,
    id_seance INT,
    heure_debut TIME,
    heure_fin TIME,
    FOREIGN KEY (id_seance) REFERENCES Seance(id_seance)
);

-- Table: Presence
CREATE TABLE Presence (
    id_utilisateur INT,
    id_plage INT,
    etat NVARCHAR(50),
    mode_emargement NVARCHAR(50),
    etablie_par_enseignant BIT,
    PRIMARY KEY (id_utilisateur, id_plage),
    FOREIGN KEY (id_utilisateur) REFERENCES Utilisateur(id_utilisateur),
    FOREIGN KEY (id_plage) REFERENCES PlageHoraire(id_plage)
);

-- Table: Justificatif
CREATE TABLE Justificatif (
    id_justificatif INT IDENTITY(1,1) PRIMARY KEY,
    id_presence_utilisateur INT,
    id_presence_plage INT,
    type NVARCHAR(100),
    lien_fichier NVARCHAR(255),
    date_depot DATE,
    date_validation DATE,
    statut_justificatif NVARCHAR(50),
    commentaire_admin NVARCHAR(255),
    FOREIGN KEY (id_presence_utilisateur, id_presence_plage) REFERENCES Presence(id_utilisateur, id_plage)
);

-- Table: Notification
CREATE TABLE Notification (
    id_notification INT IDENTITY(1,1) PRIMARY KEY,
    id_utilisateur INT,
    type_notification NVARCHAR(50),
    titre NVARCHAR(100),
    message NVARCHAR(MAX),
    niveau_priorite NVARCHAR(50),
    date_creation DATETIME,
    date_envoi DATETIME,
    date_lecture DATETIME,
    statut_notification NVARCHAR(50),
    FOREIGN KEY (id_utilisateur) REFERENCES Utilisateur(id_utilisateur)
);

-- Table: ExportPDF
CREATE TABLE ExportPDF (
    id_export INT IDENTITY(1,1) PRIMARY KEY,
    id_utilisateur INT,
    type_export NVARCHAR(50),
    periode_debut DATE,
    periode_fin DATE,
    criteres_filtrage NVARCHAR(255),
    date_demande DATETIME,
    date_generation DATETIME,
    statut_export NVARCHAR(50),
    chemin_fichier NVARCHAR(255),
    FOREIGN KEY (id_utilisateur) REFERENCES Utilisateur(id_utilisateur)
);

-- Table: HistoriqueAction
CREATE TABLE HistoriqueAction (
    id_action INT IDENTITY(1,1) PRIMARY KEY,
    id_utilisateur INT,
    action NVARCHAR(100),
    cible NVARCHAR(100),
    date_action DATETIME,
    FOREIGN KEY (id_utilisateur) REFERENCES Utilisateur(id_utilisateur)
);


-- ALTER TABLE: Add 'modules' column to Cours
ALTER TABLE Cours
ADD modules NVARCHAR(100);

-- Table: CahierDeTexte
CREATE TABLE CahierDeTexte (
    id_cahier INT IDENTITY(1,1) PRIMARY KEY,
    date DATE,
    heure_debut TIME,
    heure_fin TIME,
    objectifs NVARCHAR(MAX),
    contenu NVARCHAR(MAX),
    id_seance INT,
    id_enseignant INT,
    id_cours INT,
    FOREIGN KEY (id_seance) REFERENCES Seance(id_seance),
    FOREIGN KEY (id_enseignant) REFERENCES Enseignant(id_utilisateur),
    FOREIGN KEY (id_cours) REFERENCES Cours(id_cours)
);



-- Table: EmploiDuTemps
CREATE TABLE EmploiDuTemps (
    id_edt INT IDENTITY(1,1) PRIMARY KEY,
    statut_edt NVARCHAR(50), -- ENUM: 'à_jour', 'en_attente_sync'
    derniere_mise_a_jour DATETIME,
    date_debut_semaine DATE,
    date_fin_semaine DATE
);

-- Alter Seance to include foreign key to EmploiDuTemps
ALTER TABLE Seance
ADD id_edt INT,
    FOREIGN KEY (id_edt) REFERENCES EmploiDuTemps(id_edt);

-- Table: Formation
CREATE TABLE Formation (
    id_formation INT IDENTITY(1,1) PRIMARY KEY,
    intitule NVARCHAR(100),
    niveau NVARCHAR(10),
    specialite NVARCHAR(50),
    annee_academique NVARCHAR(20)
);

-- Alter Etudiant to include foreign key to Formation
ALTER TABLE Etudiant
ADD id_formation INT,
    FOREIGN KEY (id_formation) REFERENCES Formation(id_formation);

-- Alter EmploiDuTemps to include foreign key to Formation
ALTER TABLE EmploiDuTemps
ADD id_formation INT,
    FOREIGN KEY (id_formation) REFERENCES Formation(id_formation);
