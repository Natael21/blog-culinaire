const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const yaml = require('js-yaml');

exports.handler = async function(event, context) {
    try {
        if (event.httpMethod !== 'POST') {
            return {
                statusCode: 405,
                body: JSON.stringify({ error: 'Méthode non autorisée' })
            };
        }

        const { changes } = JSON.parse(event.body);
        
        if (!changes || !Array.isArray(changes)) {
            return {
                statusCode: 400,
                body: JSON.stringify({ error: 'Données invalides' })
            };
        }

        const restaurantsDir = path.join(process.cwd(), 'content', 'restaurants');
        const imagesDir = path.join(process.cwd(), 'images');
        
        // S'assurer que les répertoires existent
        if (!fs.existsSync(restaurantsDir)) {
            fs.mkdirSync(restaurantsDir, { recursive: true });
        }
        if (!fs.existsSync(imagesDir)) {
            fs.mkdirSync(imagesDir, { recursive: true });
        }
        
        // Traiter chaque changement
        const processedChanges = [];
        const errors = [];

        for (const change of changes) {
            try {
                if (change.type === 'delete') {
                    // Supprimer le fichier
                    const filePath = path.join(restaurantsDir, change.filename);
                    if (fs.existsSync(filePath)) {
                        fs.unlinkSync(filePath);
                        processedChanges.push(change);
                    } else {
                        // Le fichier n'existe pas, on le considère comme déjà supprimé
                        processedChanges.push(change);
                    }
                } else if (change.type === 'create') {
                    // Créer le fichier
                    const filePath = path.join(restaurantsDir, change.filename);
                    
                    // Convertir le contenu en YAML si c'est un objet
                    let content = change.content;
                    if (typeof content === 'object') {
                        const frontMatter = {
                            layout: 'restaurant',
                            title: content.title,
                            date: content.date,
                            address: content.address,
                            style: content.style,
                            state: content.state || 'draft'
                        };
                        
                        const yamlContent = yaml.dump(frontMatter);
                        content = `---\n${yamlContent}---\n\n${content.content || ''}`;
                    }
                    
                    fs.writeFileSync(filePath, content);
                    processedChanges.push(change);
                    
                    // Gérer les images si présentes
                    if (change.images && Array.isArray(change.images)) {
                        for (const image of change.images) {
                            if (image.base64 && image.filename) {
                                const imagePath = path.join(imagesDir, image.filename);
                                const imageBuffer = Buffer.from(image.base64, 'base64');
                                fs.writeFileSync(imagePath, imageBuffer);
                            }
                        }
                    }
                }
            } catch (changeError) {
                console.error(`Erreur lors du traitement du changement ${change.type}:`, changeError);
                errors.push({
                    type: change.type,
                    filename: change.filename,
                    error: changeError.message
                });
            }
        }

        // Si aucune modification n'a été traitée avec succès, retourner une erreur
        if (processedChanges.length === 0 && errors.length > 0) {
            return {
                statusCode: 500,
                body: JSON.stringify({ 
                    error: 'Aucune modification n\'a pu être appliquée',
                    details: errors
                })
            };
        }

        // Commiter et pousser les changements
        try {
            // Vérifier s'il y a des changements à commiter
            const status = execSync('git status --porcelain', { cwd: process.cwd() }).toString();
            if (status.trim()) {
                execSync('git add .', { cwd: process.cwd() });
                execSync('git commit -m "Mise à jour des restaurants"', { cwd: process.cwd() });
                execSync('git push', { cwd: process.cwd() });
            }
        } catch (gitError) {
            console.error('Erreur Git:', gitError);
            // Si des changements ont été traités mais que le push échoue, on retourne un succès partiel
            if (processedChanges.length > 0) {
                return {
                    statusCode: 200,
                    body: JSON.stringify({ 
                        message: 'Modifications appliquées localement mais erreur lors du push',
                        processed: processedChanges,
                        errors: errors,
                        gitError: gitError.message
                    })
                };
            }
            throw new Error(`Erreur lors de la publication sur GitHub: ${gitError.message}`);
        }

        return {
            statusCode: 200,
            body: JSON.stringify({ 
                message: 'Modifications appliquées avec succès',
                processed: processedChanges,
                errors: errors
            })
        };
    } catch (error) {
        console.error('Erreur:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ 
                error: `Erreur lors de l'application des modifications: ${error.message}`,
                details: error.stack
            })
        };
    }
}; 