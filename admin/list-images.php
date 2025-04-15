<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');

$imagesDir = '../images/';
$images = [];

// Liste des extensions d'images autorisées
$allowedExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'PNG', 'JPG', 'JPEG'];

if (is_dir($imagesDir)) {
    $files = scandir($imagesDir);
    foreach ($files as $file) {
        $extension = pathinfo($file, PATHINFO_EXTENSION);
        if (in_array($extension, $allowedExtensions)) {
            $images[] = [
                'name' => $file,
                'path' => '/images/' . $file
            ];
        }
    }
}

echo json_encode($images); 