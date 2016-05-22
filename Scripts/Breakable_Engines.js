this.name        = "Breakable_Engines"; 
this.author      = "capt murphy"; 
this.copyright   = "2012 capt murphy";
this.licence     = "CC BY-NC-SA 3.0"; // see http://creativecommons.org/licenses/by-nc-sa/3.0/ for more info.
this.description = "Script to simulate combat damage to the ships engines"; 
this.version     = "1.1";

// event handler driven function for functions at startup - awards equipment to existing ship if first run with OXP.
this.startUp = function()
{
	this.warning = new SoundSource;
	this.warning.sound = "warning.ogg";
	this.explosion = new SoundSource;
	this.explosion.sound = "hullbang.ogg";
	if (!missionVariables.beng_speedThreshold) {missionVariables.beng_speedThreshold = 0.5;}
	this.speedThreshold = missionVariables.beng_speedThreshold;
	this.getEngineSize();
	if (player.ship.equipmentStatus(this.engineEQ) === "EQUIPMENT_UNAVAILABLE"){missionVariables.beng_status = this.engineEQ; player.ship.awardEquipment(this.engineEQ); missionVariables.beng_status = "OK";}
}

this.getEngineSize = function()
{
	var sizeVar = (player.ship.maxEnergy + player.ship.cargoSpaceCapacity)*(player.ship.maxSpeed/100);
	if (sizeVar < 512){this.engineEQ = "EQ_BREAKABLE_ENGINE_SMALL";}
	else if (sizeVar < 1024){this.engineEQ = "EQ_BREAKABLE_ENGINE_MEDIUM";}
	else if (sizeVar < 2048){this.engineEQ = "EQ_BREAKABLE_ENGINE_LARGE";}
	else {this.engineEQ = "EQ_BREAKABLE_ENGINE_MONSTER";}
}
	
// event handler driven function to fit equipment to newly purchased ship.
this.playerBoughtNewShip = function()
{
	this.getEngineSize();
	missionVariables.beng_status = this.engineEQ;
	player.ship.awardEquipment(this.engineEQ);
	missionVariables.beng_status = "OK";
}

// event handler driven function to control actions if equipment damaged in combat.
this.equipmentDamaged = this.equipmentDestroyed = function(equipment)
{
	if (this.shipRestore && equipment === this.engineEQ) {missionVariables.beng_status = this.engineEQ; return;}
	if (equipment === this.engineEQ && player.ship.equipmentStatus("EQ_FUEL_INJECTION") === "EQUIPMENT_OK")
	{
		player.ship.setEquipmentStatus(equipment,"EQUIPMENT_OK");
		if (player.ship.setEquipmentStatus("EQ_FUEL_INJECTION","EQUIPMENT_DAMAGED"))
		{player.consoleMessage("Injectors are damaged!", 3);}
		return;
	}
	if (equipment === this.engineEQ)
	{
		var EQarray = player.ship.equipment;
		var EQdamaged = new Array;
		var counter;
		for(counter = 0; counter < EQarray.length; counter++)
		{
			if (player.ship.equipmentStatus(EQarray[counter])==="EQUIPMENT_DAMAGED")
			{EQdamaged.push(EQarray[counter]);EQarray.splice(counter,1);counter--;continue;}
			if (!EQarray[counter].isVisible || EQarray[counter] === equipment || !EQarray[counter].canBeDamaged)
			{EQarray.splice(counter,1);counter--;}
		}
		if (EQdamaged.length < 3 || Math.random() > 0.334) // reduced chance of equipment damage.
		{
			if (EQarray.length > 0)
			{
				var index = Math.floor(Math.random() * EQarray.length);
				player.ship.setEquipmentStatus(EQarray[index],"EQUIPMENT_DAMAGED");
				this.damagedEQ = EQarray[index];
				this.delayTimer = new Timer (this, this.delayMessage,0.25);
			}
			player.ship.setEquipmentStatus(equipment,"EQUIPMENT_OK");
			return;
		}
		missionVariables.beng_status = this.engineEQ;
		this.speedThreshold = 0.5;
		this.explosion.play(1);
		player.consoleMessage("System Drive Damaged!",3);
		this.setupTimer();
	}
}

this.delayMessage = function()
{
 if (this.damagedEQ && player.ship.equipmentStatus(this.damagedEQ) === "EQUIPMENT_DAMAGED")
 {player.consoleMessage(this.damagedEQ.name + " damaged!"); delete this.damagedEQ;}
}

this.delayMessage1 = function()
{
 if (this.damagedEQ && player.ship.equipmentStatus(this.damagedEQ) === "EQUIPMENT_DAMAGED")
 {player.consoleMessage(this.damagedEQ.name + " damaged by System Drive explosion!"); delete this.damagedEQ;}
}
		
// event handler driven function for actions on launching and exiting witchspace.
this.shipLaunchedFromStation = this.shipExitedWitchspace = function()
{
	if (player.ship.equipmentStatus(this.engineEQ) === "EQUIPMENT_OK" && missionVariables.beng_status !== "OK")
	{
		this.reset();	
	}
	if (missionVariables.beng_status !== "OK")
	{
		this.setupTimer();
	}
}

// event handler driven function to stop timers on docking or player death.
this.shipWillDockWithStation = this.shipDied = function()
{
	if (this.updateTimer && this.updateTimer.isRunning)
		{
			this.updateTimer.stop();
			delete this.updateTimer;
		}
	delete this.warned;
}

// event handler driven function for actions on save game.
this.playerWillSaveGame = function()
{
	missionVariables.beng_speedThreshold = this.speedThreshold;
}

// creates timers if not already in existance otherwise restarts existing timers.
this.setupTimer = function()
{
	if (this.updateTimer && this.updateTimer.isRunning){this.updateTimer.stop();delete this.updateTimer;}
	this.updateTimer = new Timer(this,this.updateEngine,0,5);
}
	

// called by timer every 5 seconds when player in flight to give warning noise whilst a shield is damaged.
this.updateEngine = function()
{
	if (player.ship.equipmentStatus(this.engineEQ) === "EQUIPMENT_OK" && missionVariables.beng_status !== "OK") // check to see if something has repaired the engine on the fly e.g. Thargoid's Repair Bots OXP.
	{
		this.reset();
		return;
	}
	if (!this.message){this.message = true;} else {delete this.message;}
	if (player.ship.speed > player.ship.maxSpeed)
	{if (this.message){player.consoleMessage("Warning - System Drive damaged. Disengaged whilst using Torus",3);}return;} // Torus Drive can still be used
	if ((player.ship.speed/player.ship.maxSpeed) > this.speedThreshold) // over speed threshold?
	{
		this.warning.play(1);
		player.consoleMessage("Warning - System Drive damaged and unstable, reduce speed at once!",3);
		if (!this.warned){this.warned = true;return;}
		this.explosion.play(1);
		var damage = (player.ship.speed/player.ship.maxSpeed) - this.speedThreshold;
		player.ship.energy -= (player.ship.maxEnergy * damage);
		var EQarray = player.ship.equipment;
		var counter;
		for(counter = 0; counter < EQarray.length; counter++)
		{
			if (!EQarray[counter].isVisible || player.ship.equipmentStatus(EQarray[counter])==="EQUIPMENT_DAMAGED" || !EQarray[counter].canBeDamaged){EQarray.splice(counter,1);counter--;}
		}
		if (EQarray.length > 0)
			{
				var index = Math.floor(Math.random() * EQarray.length);
				player.ship.setEquipmentStatus(EQarray[index],"EQUIPMENT_DAMAGED");
				this.damagedEQ = EQarray[index];
				this.delayTimer = new Timer (this, this.delayMessage1,0.25);
				return;
			}
		if (this.speedThreshold > 0.1){this.speedThreshold -= 0.1}
		return;
	}
	if (this.warned){delete this.warned;}
	if (this.message){this.warning.play(1);}
	if (this.message){player.consoleMessage("Warning - System Drive damaged but stable at current speed.",3);}
}

this.reset = function()
{
	if (player.ship.equipmentStatus(this.engineEQ) === "EQUIPMENT_OK" && missionVariables.beng_status !== "OK")
	{
		if (this.updateTimer && this.updateTimer.isRunning)
			{
				this.updateTimer.stop();
				delete this.updateTimer;
			}
		delete this.warned;
		this.speedThreshold = 0.5;
		missionVariables.beng_status = "OK";
	}
}