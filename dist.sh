#!/bin/bash
FOLDER="just-track-time"
DIST_ZIP="just-track-time.zip"
rm -rdf $DIST_ZIP $FOLDER
mkdir $FOLDER
cp main.js $FOLDER
cp styles.css $FOLDER
cp manifest.json $FOLDER
zip -r $DIST_ZIP $FOLDER
rm -rdf $FOLDER
