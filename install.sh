#!/bin/bash
echo "Installerer Space Rollr..."
sudo apt install python3-pygame -y
cd ~
git clone https://github.com/ohmygorseth/spacerollr-office.git
cp ~/spacerollr-office/spacerollr.desktop ~/.local/share/applications/
chmod +x ~/.local/share/applications/spacerollr.desktop
echo "Ferdig! Space Rollr ligger nå i appmenyen."
