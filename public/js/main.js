(function() {
	
	var eles = {
		loginButton:      document.getElementById('login-button'),
		logoutButton:     document.getElementById('logout-button'),
		unauthFooterText: document.getElementById('unauth-footer-text'),
		addRockButton:    document.getElementById('add-rock-button'),
		addRockModal:     document.getElementById('modal-one'),
		closeButton:      document.getElementById('btn-close'),
		descriptionInput: document.getElementById('description'),
		locationInput:    document.getElementById('location'),
		messageContainer: document.getElementById('message-container'),
		submitButton:     document.getElementById('submit-button'),
		eventContainer:   document.getElementById('event-container'), 
		map:              document.getElementById('map')
	};

	var vars = {
		userId:          '',
		userProfile:     {},
		gettingLocation: false,
		markers:         [],
		allMarkers:      [],
		infoWindow:      null
	};

	var funcs = {
		init: function() {
			if(firebase.auth().currentUser) {
				funcs.showAuthElements();
				firebase.database().ref('/users/' + firebase.auth().currentUser.uid).once('value').then(function(snapshot) {
					vars.userProfile.name =  snapshot.val().name;
					vars.userProfile.photo = snapshot.val().photo;
				});
			}
			else {
				funcs.hideAuthElements();
			}

			vars.bounds = new google.maps.LatLngBounds();
			vars.infoWindow = new google.maps.InfoWindow({maxWidth:400});

			firebase.auth().onAuthStateChanged(function(user) {
				if (user) {
					vars.userId = user.uid;
				} 
			});

			funcs.getEvents();
			funcs.getRocks();
		},
		login: function(e) {
			e.preventDefault();

			var provider = new firebase.auth.FacebookAuthProvider();
			firebase.auth().signInWithPopup(provider).then(function(result) {
				vars.token = result.credential.accessToken;
				
				vars.userProfile = {
					photo: result.user.photoURL,
					name:  result.user.displayName
				};
				vars.userId = result.user.uid;

				firebase.database().ref('users/' + result.user.uid).set(vars.userProfile);
				
				funcs.showAuthElements();
			}).catch(function(error) {
				console.log("error", error);
				// Handle Errors here.
				var errorCode = error.code;
				var errorMessage = error.message;

				// The email of the user's account used.
				var email = error.email;
				// The firebase.auth.AuthCredential type that was used.
				var credential = error.credential;
				// ...
			});
		},
		logout: function() {
			firebase.auth().signOut().then(function() {
				funcs.hideAuthElements();

				// Sign-out successful.
			}, function(error) {
				// An error happened.
			});
		},
		showAuthElements: function() {
			// Hide unauth stuff
			eles.loginButton.classList.add('hidden');
			eles.unauthFooterText.classList.add('hidden');

			// Show auth stuff
			eles.logoutButton.classList.remove('hidden');
			eles.addRockButton.classList.remove('hidden');
			eles.map.classList.add('logged');
		},
		hideAuthElements: function() {
			// Hide auth stuff
			eles.logoutButton.classList.add('hidden');
			eles.addRockButton.classList.add('hidden');
			eles.map.classList.remove('logged');
			
			// Show unauth stuff
			eles.unauthFooterText.classList.remove('hidden');
			eles.loginButton.classList.remove('hidden');
		},
		toggleModal: function() {
			eles.messageContainer.innerHTML = '';
			eles.descriptionInput.value =     '';
			eles.locationInput.value    =     '';
			eles.addRockModal.classList.toggle('active');

			// Focus is bringing up keyboard, hiding the button...idk if I like that...
			// if(eles.addRockModal.classList.contains('active')) {
			// 	eles.descriptionInput.focus();
			// }
		},
		getLocation: function() {
			// If we're already getting the location, get out of here!
			if(vars.gettingLocation) {
				return;
			}
			vars.gettingLocation = true;

			if(!navigator.geolocation) {
				eles.messageContainer.text = tmpls.noSupport;
			}

			eles.submitButton.innerHTML = 'Getting location...';
			navigator.geolocation.getCurrentPosition(funcs.addRock, funcs.locationFail);
		},
		locationFail: function() {
			vars.gettingLocation = false;
			eles.submitButton.innerHTML = tmpls.submitText();
			eles.messageContainer.innerHTML = tmpls.noLocation();
		},
		addRock: function(position) {
			
			var userId = '',
			    name   = '',
			    photo  = '';

			firebase.database().ref('/users/' + vars.userId).once('value').then(function(snapshot) {
				name  = snapshot.val().name;
				photo = snapshot.val().photo;

				var rock = {
					description: eles.descriptionInput.value,
					location:    eles.locationInput.value,
					latitude:    position.coords.latitude,
					longitude:   position.coords.longitude,
					name:        name,
					photo:       photo
				};
				
				var event = {
					postedName:  name,
					postedPhoto: photo,
					added:       true,
					date:        Date.now()
				};

				vars.gettingLocation = false;
				eles.submitButton.innerHTML = tmpls.submitText();
				funcs.toggleModal();

				firebase.database().ref().child('rocks').push(rock);
				firebase.database().ref().child('events').push(event);
			});
		},
		getRocks: function() {
			var ref = firebase.database().ref('rocks/');
			ref.on('value', function(snapshot) {
				vars.markers = [];
				var rocks = snapshot.val();
				for (var key in rocks) {
					if (!rocks.hasOwnProperty(key)) {
						continue;
					}
					var rock = rocks[key];
					vars.markers.push([ 
						rock.name,
						rock.photo,
						rock.latitude,
						rock.longitude,
						rock.description,
						rock.location,
						key
					]);		
				}
				funcs.setMarkers(map);
			});
		},
		getEvents: function() {
			var ref = firebase.database().ref('events/');
			ref.limitToLast(25).on('child_added', function(snapshot) {
				var event = snapshot.val();
				var container = document.createElement('div');

				container.classList.add('event');
				container.innerHTML = tmpls.eventContent(event);

				eles.eventContainer.insertBefore(container, eles.eventContainer.children[0]);
				
				var eventCount = eles.eventContainer.children.length;

				if(eventCount > 25) {
					eles.eventContainer.children[eventCount - 1].remove();
				}
			});
		},
		clearMarkers: function() {
			for (var i = 0; i < vars.allMarkers.length; i++) {
				vars.allMarkers[i].setMap(null);
			}
			vars.allMarkers = [];
		},
		setMarkers: function(map) {
			var latlng,
			    mark,
			    content;

			funcs.clearMarkers();

			for( i = 0; i < vars.markers.length; i++ ) {
				var position = new google.maps.LatLng(vars.markers[i][2], vars.markers[i][3]);

				marker = new google.maps.Marker({
					position: position,
					map: map,
					title: vars.markers[i][0]
				});

				vars.allMarkers.push(marker);

				google.maps.event.addListener(marker, 'click', (function(marker, i) {
					return function() {
						vars.infoWindow.setContent(tmpls.markerContent(vars.markers[i]));
						vars.infoWindow.open(map, marker);
					}
				})(marker, i));
			}
		},
		stripSpecial: function(str) {
			return str.replace(/[^a-zA-Z0-9\s\:\.\?\!\/\"\'\-\_\=\&]*/g, '');
		},
		formatTime: function(date_obj) {
			//https://gist.github.com/hjst/1326755
			// formats a javascript Date object into a 12h AM/PM time string
			var hour = date_obj.getHours(),
			    minute = date_obj.getMinutes(),
			    amPM = (hour > 11) ? "PM" : "AM";
			
			if(hour > 12) {
				hour -= 12;
			} 
			else if(hour == 0) {
				hour = "12";
			}
			
			if(minute < 10) {
				minute = "0" + minute;
			}
			
			return hour + ":" + minute + amPM + ', on ' + date_obj.getDate() + '/' + date_obj.getMonth() + '/' + date_obj.getFullYear();
		}
	};

	var tmpls = {
		noSupport: function() {
			return (
				'<p>Sorry, your browser doesn\'t support geolocation!</p>'
			)
		},
		noLocation: function() {
			return (
				'<p>Sorry, we couldn\'t nail down your location!</p>'
			);
		},
		submitText: function() {
			return (
				'Put it on the map!'
			);
		},
		markerContent: function(marker) {
			var description = '', 
			    location =    '';

			if(marker[4]) {
				description = '<h4>Rock Description:</h4><p>' + funcs.stripSpecial(marker[4]) + '</p>';
			}
			if(marker[5]) {
				location = '<h4>Location Hint:</h4><p>' + funcs.stripSpecial(marker[5]) + '</p>';	
			}
			return (
				'<div class="info-content">' +
					'<span class="login-message">Log in to mark it found!</span>' +
					'<button onClick="window.removeMarker(\'' + marker[6] + '\')">Found It!</button>' +
					description + location +
					'<h4>Rocker:</h4>' +
					'<p>' + funcs.stripSpecial(marker[0]) + '</p>' +
					'<img src="' + marker[1] + '" alt="profile photo">' +
				'</div>'
			);
		},
		eventContent: function(event) {
			var eventText = '',
				eventDate = new Date(event.date);

			// A rock was added
			if(event.added) {
				eventText = '<div class="placed"><img src="' + funcs.stripSpecial(event.postedPhoto) + '" alt="' + funcs.stripSpecial(event.postedName) + '">' +
				              '<p>' + event.postedName + ' placed a rock! <span class="timestampContainer">' + funcs.formatTime(eventDate) +
				              "</span></p>"+
			                '</div>';
			}
			// A rock was found
			else {
				eventText = '<div class="found"><img src="' + funcs.stripSpecial(event.foundPhoto) + '" alt="' + funcs.stripSpecial(event.foundName) + '">' +
				              '<p>' + event.foundName + ' found a rock placed by ' + event.postedName + '! <span class="timestampContainer">' + funcs.formatTime(eventDate) +
				              "</span></p>"+
			                '</div>';
			}
			return (
				eventText
			);
		}
	};

	// Listeners
	eles.loginButton.addEventListener('click', funcs.login);
	eles.logoutButton.addEventListener('click', funcs.logout);
	eles.addRockButton.addEventListener('click', funcs.toggleModal);
	eles.closeButton.addEventListener('click', funcs.toggleModal);
	eles.submitButton.addEventListener('click', funcs.getLocation);

	window.addEventListener('load', funcs.init);

	// Drunk, fix later
	window.removeMarker = function(key) {
		var name =  '',
		    photo = '';
		firebase.database().ref('/rocks/' + key).once('value').then(function(snapshot) {
			name  = snapshot.val().name;
			photo = snapshot.val().photo;
			var event = {
				foundName:   vars.userProfile.name,
				foundPhoto:  vars.userProfile.photo,
				postedName:  name,
				postedPhoto: photo,
				added:       false,
				date:        Date.now()
			};
			firebase.database().ref().child('events').push(event);
			firebase.database().ref('/rocks/' + key).remove();
		});	
	}

})();

