import Ember from 'ember';

export default Ember.ArrayController.extend({
	resetNewUser: function(){
    	this.set("newUser", Ember.Object.create({firstName: "", lastName: "", email: ""}));
	}
});